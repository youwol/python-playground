
const runTimeDependencies = {
    "externals": {
        "@youwol/fv-code-mirror-editors": "^0.2.2",
        "@youwol/os-core": "^0.1.5",
        "@youwol/fv-tabs": "^0.2.1",
        "@youwol/os-top-banner": "^0.1.1",
        "@youwol/cdn-client": "^1.0.10",
        "@youwol/http-clients": "^2.0.1",
        "@youwol/flux-view": "^1.0.3",
        "@youwol/fv-context-menu": "^0.1.1",
        "@youwol/fv-tree": "^0.2.3",
        "lodash": "^4.17.15",
        "rxjs": "^6.5.5",
        "@youwol/logging": "^0.1.0",
        "uuid": "^8.3.2",
        "@youwol/pyodide-helpers": "^0.1.2"
    },
    "includedInBundle": {}
}
const externals = {
    "@youwol/fv-code-mirror-editors": "window['@youwol/fv-code-mirror-editors_APIv02']",
    "@youwol/os-core": "window['@youwol/os-core_APIv01']",
    "@youwol/fv-tabs": "window['@youwol/fv-tabs_APIv02']",
    "@youwol/os-top-banner": "window['@youwol/os-top-banner_APIv01']",
    "@youwol/cdn-client": "window['@youwol/cdn-client_APIv1']",
    "@youwol/http-clients": "window['@youwol/http-clients_APIv2']",
    "@youwol/flux-view": "window['@youwol/flux-view_APIv1']",
    "@youwol/fv-context-menu": "window['@youwol/fv-context-menu_APIv01']",
    "@youwol/fv-tree": "window['@youwol/fv-tree_APIv02']",
    "lodash": "window['__APIv4']",
    "rxjs": "window['rxjs_APIv6']",
    "@youwol/logging": "window['@youwol/logging_APIv01']",
    "uuid": "window['uuid_APIv8']",
    "@youwol/pyodide-helpers": "window['@youwol/pyodide-helpers_APIv01']",
    "rxjs/operators": "window['rxjs_APIv6']['operators']"
}
const exportedSymbols = {
    "@youwol/fv-code-mirror-editors": {
        "apiKey": "02",
        "exportedSymbol": "@youwol/fv-code-mirror-editors"
    },
    "@youwol/os-core": {
        "apiKey": "01",
        "exportedSymbol": "@youwol/os-core"
    },
    "@youwol/fv-tabs": {
        "apiKey": "02",
        "exportedSymbol": "@youwol/fv-tabs"
    },
    "@youwol/os-top-banner": {
        "apiKey": "01",
        "exportedSymbol": "@youwol/os-top-banner"
    },
    "@youwol/cdn-client": {
        "apiKey": "1",
        "exportedSymbol": "@youwol/cdn-client"
    },
    "@youwol/http-clients": {
        "apiKey": "2",
        "exportedSymbol": "@youwol/http-clients"
    },
    "@youwol/flux-view": {
        "apiKey": "1",
        "exportedSymbol": "@youwol/flux-view"
    },
    "@youwol/fv-context-menu": {
        "apiKey": "01",
        "exportedSymbol": "@youwol/fv-context-menu"
    },
    "@youwol/fv-tree": {
        "apiKey": "02",
        "exportedSymbol": "@youwol/fv-tree"
    },
    "lodash": {
        "apiKey": "4",
        "exportedSymbol": "_"
    },
    "rxjs": {
        "apiKey": "6",
        "exportedSymbol": "rxjs"
    },
    "@youwol/logging": {
        "apiKey": "01",
        "exportedSymbol": "@youwol/logging"
    },
    "uuid": {
        "apiKey": "8",
        "exportedSymbol": "uuid"
    },
    "@youwol/pyodide-helpers": {
        "apiKey": "01",
        "exportedSymbol": "@youwol/pyodide-helpers"
    }
}

const mainEntry : {entryFile: string,loadDependencies:string[]} = {
    "entryFile": "./index.ts",
    "loadDependencies": [
        "@youwol/fv-code-mirror-editors",
        "@youwol/os-core",
        "@youwol/fv-tabs",
        "@youwol/os-top-banner",
        "@youwol/cdn-client",
        "@youwol/http-clients",
        "@youwol/flux-view",
        "@youwol/fv-context-menu",
        "@youwol/fv-tree",
        "lodash",
        "rxjs",
        "@youwol/logging",
        "uuid",
        "@youwol/pyodide-helpers"
    ]
}

const secondaryEntries : {[k:string]:{entryFile: string, name: string, loadDependencies:string[]}}= {}

const entries = {
     '@youwol/python-playground': './index.ts',
    ...Object.values(secondaryEntries).reduce( (acc,e) => ({...acc, [`@youwol/python-playground/${e.name}`]:e.entryFile}), {})
}
export const setup = {
    name:'@youwol/python-playground',
        assetId:'QHlvdXdvbC9weXRob24tcGxheWdyb3VuZA==',
    version:'0.1.4',
    shortDescription:"Python playground application",
    developerDocumentation:'https://platform.youwol.com/applications/@youwol/cdn-explorer/latest?package=@youwol/python-playground',
    npmPackage:'https://www.npmjs.com/package/@youwol/python-playground',
    sourceGithub:'https://github.com/youwol/python-playground',
    userGuide:'https://l.youwol.com/doc/@youwol/python-playground',
    apiVersion:'01',
    runTimeDependencies,
    externals,
    exportedSymbols,
    entries,
    secondaryEntries,
    getDependencySymbolExported: (module:string) => {
        return `${exportedSymbols[module].exportedSymbol}_APIv${exportedSymbols[module].apiKey}`
    },

    installMainModule: ({cdnClient, installParameters}:{
        cdnClient:{install:(unknown) => Promise<Window>},
        installParameters?
    }) => {
        const parameters = installParameters || {}
        const scripts = parameters.scripts || []
        const modules = [
            ...(parameters.modules || []),
            ...mainEntry.loadDependencies.map( d => `${d}#${runTimeDependencies.externals[d]}`)
        ]
        return cdnClient.install({
            ...parameters,
            modules,
            scripts,
        }).then(() => {
            return window[`@youwol/python-playground_APIv01`]
        })
    },
    installAuxiliaryModule: ({name, cdnClient, installParameters}:{
        name: string,
        cdnClient:{install:(unknown) => Promise<Window>},
        installParameters?
    }) => {
        const entry = secondaryEntries[name]
        if(!entry){
            throw Error(`Can not find the secondary entry '${name}'. Referenced in template.py?`)
        }
        const parameters = installParameters || {}
        const scripts = [
            ...(parameters.scripts || []),
            `@youwol/python-playground#0.1.4~dist/@youwol/python-playground/${entry.name}.js`
        ]
        const modules = [
            ...(parameters.modules || []),
            ...entry.loadDependencies.map( d => `${d}#${runTimeDependencies.externals[d]}`)
        ]
        return cdnClient.install({
            ...parameters,
            modules,
            scripts,
        }).then(() => {
            return window[`@youwol/python-playground/${entry.name}_APIv01`]
        })
    },
    getCdnDependencies(name?: string){
        if(name && !secondaryEntries[name]){
            throw Error(`Can not find the secondary entry '${name}'. Referenced in template.py?`)
        }
        const deps = name ? secondaryEntries[name].loadDependencies : mainEntry.loadDependencies

        return deps.map( d => `${d}#${runTimeDependencies.externals[d]}`)
    }
}
