import tasks = require('azure-pipelines-task-lib');
import tools = require('azure-pipelines-tool-lib');
import path = require('path');
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import { downloadProduct } from './installer';

async function configure(productName: string) {
    const inputVersion = tasks.getInput("version", true);
    
    const executablePath = await downloadProduct(productName, inputVersion!);

    const envPath = process.env['PATH'];

    // Prepend the tools path. Instructs the agent to prepend for future tasks
    if (envPath && !envPath.startsWith(path.dirname(executablePath))) {
        tools.prependPath(path.dirname(executablePath));
    }

    tasks.setVariable('binaryLocation', executablePath);
}

async function verify(productName: string) {
    console.log(tasks.loc("VerifyInstallation"));
    
    let binaryPath = tasks.which(productName, true);

    binaryPath = path.resolve(binaryPath);

    const tool: ToolRunner = tasks.tool(binaryPath);
    tool.arg("version");
    
    return await tool.execAsync();
}

export async function run(productName: string) {
    tasks.setResourcePath(path.join(__dirname, '..', 'task.json'));

    try {
        await configure(productName);
        await verify(productName);

        tasks.setResult(tasks.TaskResult.Succeeded, "");
    } catch (error) {
        tasks.setResult(tasks.TaskResult.Failed, error + "");
    }
}
