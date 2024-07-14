import tasks = require('azure-pipelines-task-lib');
import tools = require('azure-pipelines-tool-lib');
import path = require('path');
import os = require('os');
import fs = require('fs');

const uuidV4 = require('uuid/v4');
const fetch = require('node-fetch');
const HttpsProxyAgent = require('https-proxy-agent');

const isWindows = os.type().match(/^Win/);

const proxy = tasks.getHttpProxyConfiguration();

interface IHashiCorpRelease {
    builds: IHashiCorpBuild[];
    version: string;
}
interface IHashiCorpBuild {
    arch: string;
    os: string;
    url: string;
}

export async function downloadProduct(productName: string, inputVersion: string): Promise<string> {
    
    let fetchOptions = undefined;

    if (proxy) {
        var proxyUrl = proxy.proxyUsername !="" ? proxy.proxyUrl.split("://")[0] + '://' + proxy.proxyUsername + ':' + proxy.proxyPassword + '@' + proxy.proxyUrl.split("://")[1]:proxy.proxyUrl;
        var proxyAgent = new HttpsProxyAgent(proxyUrl);

        fetchOptions = { agent: proxyAgent };
    }

    let release: IHashiCorpRelease;
    let build: IHashiCorpBuild;

    try {
        console.log(tasks.loc("SearchingVersion", inputVersion));

        const response = await fetch(`https://api.releases.hashicorp.com/v1/releases/${productName}/${inputVersion}`, fetchOptions);

        release = await response.json();
    }
    catch(ex) {
        throw new Error(tasks.loc("VersionNotFound", inputVersion));
    }
    
    build = getBuildForThisPlatform(release);
    
    let cachedToolPath = tools.findLocalTool(productName, release.version);

    if (!cachedToolPath) {
        const fileName = `${productName}-${release.version}-${uuidV4()}.zip`;
        let downloadPath;

        try {
            downloadPath = await tools.downloadTool(build.url, fileName);
        } catch (ex) {
            throw new Error(tasks.loc("DownloadFailed", build.url, ex));
        }

        const unzippedPath = await tools.extractZip(downloadPath);

        cachedToolPath = await tools.cacheDir(unzippedPath, productName, release.version);
    }

    const executablePath = findExecutable(cachedToolPath, productName);

    if (!executablePath)
        throw new Error(tasks.loc("ExecutableNotFoundInFolder", cachedToolPath));

    if (!isWindows)
        fs.chmodSync(executablePath, "777");

    return executablePath;
}

function getBuildForThisPlatform(release: IHashiCorpRelease): IHashiCorpBuild {
    if (!release)
        throw new Error("release was null.");

    let platform: string = "unknown";
    let architecture: string = "unknown";

    switch(os.type()) {
        case "Darwin":
            platform = "darwin";
            break;
        
        case "Linux":
            platform = "linux";
            break;
        
        case "Windows_NT":
            platform = "windows";
            break;
    }

    switch(os.arch()) {
        case "x64":
            architecture = "amd64";
            break;
        
        case "x32":
            architecture = "386";
            break;

        case "arm64":
            architecture = "arm64";
            break;

        case "arm":
            architecture = "arm";
            break;
    }

    const build = release.builds.find(x => x.os === platform && x.arch === architecture);

    if (!build)
        throw new Error(tasks.loc("BuildNotFoundInRelease", os.type(), os.arch()));

    return build;
}

function findExecutable(rootFolder: string, productName: string): string | null {
    rootFolder = path.resolve(rootFolder);

    const executablePath = path.join(rootFolder, productName + getExecutableExtension());
    const allPaths = tasks.find(rootFolder);
    const matchingResultFiles = tasks.match(allPaths, executablePath, rootFolder);

    return matchingResultFiles.length === 1 ? path.resolve(matchingResultFiles[0]) : null;
}

function getExecutableExtension(): string {
    return isWindows ? ".exe" : "";
}
