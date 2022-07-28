import { InstallMessageEvent } from '../models'
import { ProjectState } from './project.state'

export function formatInstallMessages(
    projectId: string,
    rawMessage: string,
): InstallMessageEvent[] {
    if (
        rawMessage.startsWith('Loading') &&
        !rawMessage.includes('/api/assets-gateway')
    ) {
        const packages = rawMessage.split('Loading ')[1].split(', ')
        return packages.map((library) => {
            return {
                projectId,
                packageName: library,
                step: 'queued',
            }
        })
    }
    if (
        rawMessage.startsWith('Loading') &&
        rawMessage.includes('/api/assets-gateway')
    ) {
        const library = rawMessage.split(' ')[1]
        return [
            {
                projectId,
                packageName: library,
                step: 'loading',
            },
        ]
    }
    if (rawMessage.startsWith('Loaded')) {
        const packages = rawMessage.split('Loaded ')[1].split(', ')
        return packages.map((library) => {
            return {
                projectId,
                packageName: library,
                step: 'loaded',
            }
        })
    }
    return []
}

export function outputPython2Js(data) {
    if (!data) {
        return data
    }
    let recFct = (d) => {
        if (d instanceof Map) {
            let converted = {}
            d.forEach((v, k) => {
                converted[k] = recFct(v)
            })
            return converted
        }
        if (Array.isArray(d)) {
            return d.map((v) => {
                return recFct(v)
            })
        }
        return d
    }
    const jsData = data.toJs && data.toJs()
    return recFct(jsData || data)
}

export function patchPythonSrc(originalSrc: string) {
    return `
import sys
from youwol_utils import info, projectModules
class Logger(object):
    def __init__(self):
        self.terminal = sys.stdout

    def write(self, message):
        info(message)
        
sys.stdout = Logger()        
for module_name in projectModules:
    if module_name in sys.modules:
        del sys.modules[module_name]
${originalSrc}
`
}

export function registerYouwolUtilsModule(
    pyodide,
    fileSystem: Map<string, string>,
    projectState: ProjectState,
) {
    pyodide.registerJsModule('youwol_utils', {
        info: (message: string) => {
            message.trim() != '' &&
                projectState.rawLog$.next({
                    level: 'info',
                    message: message,
                })
        },
        js: (obj) => outputPython2Js(obj),
        new: (T, ...p) => new T(...p),
        call: (obj: unknown, method: string, ...args) => obj[method](...args),
        projectModules: Array.from(fileSystem.keys()).map(
            (k) => k.substring(1).split('.py')[0],
        ),
        display: (title: string, htmlElement: HTMLElement) => {
            projectState.displayElement$.next({ title, htmlElement })
        },
    })
}
