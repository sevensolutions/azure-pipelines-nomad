# HashiCorp Nomad for Azure Pipelines

The *Nomad tool installer*-task acquires a specified version of Nomad from the Internet or the tools cache and prepends it to the PATH of the Azure Pipelines Agent (hosted or private). You can then use the *nomad*-CLI in subsequent bash/cmd scripts.

## How to Build and Deploy

Update version numbers in task.json files and vss-extension.json.

```
npm run publish:dev
or
npm run publish
```
