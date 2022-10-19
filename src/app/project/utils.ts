import { ProjectState } from './project.state'

export function outputPython2Js(data) {
    if (!data) {
        return data
    }
    const recFct = (d) => {
        if (d instanceof Map) {
            const converted = {}
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

export function patchPythonSrc(fileName: string, originalSrc: string) {
    return `
import sys
from youwol_utils import log_info, log_error,projectModules

__file__ = '/home/pyodide/${fileName.replace('./', '')}'

class LoggerInfo(object):
    def __init__(self):
        self.terminal = sys.stdout

    def write(self, message):
        log_info(message)
        
class LoggerError(object):
    def __init__(self):
        self.terminal = sys.stderr

    def write(self, message):
        print("An error!!", message)
        log_error(message)
        
sys.stdout = LoggerInfo()  
sys.stderr = LoggerError()       
 
for module_name in projectModules:
    if module_name in sys.modules:
        del sys.modules[module_name]

${originalSrc}
`
}

export async function registerYouwolUtilsModule(
    pyodide,
    fileSystem: Map<string, string>,
    projectState: ProjectState,
) {
    for(const key of Array.from(fileSystem.keys())) {
        const value = fileSystem.get(key)
        if(key.endsWith('.js')){
            const jsModule = await new Function(value)()(window)
            const name = key.substring(2).split('.js')[0]
            pyodide.registerJsModule(name, jsModule)
        }
    }
    pyodide.registerJsModule('youwol_utils', {
        log_info: (message: string) => {
            message.trim() != '' &&
                projectState.rawLog$.next({
                    level: 'info',
                    message: message,
                })
        },
        log_error: (message: string) => {
            message.trim() != '' &&
                projectState.rawLog$.next({
                    level: 'error',
                    message: message,
                })
        },
        js: (obj) => outputPython2Js(obj),
        new: (T, ...p) => new T(...p),
        call: (obj: unknown, method: string, ...args) => obj[method](...args),
        projectModules: Array.from(fileSystem.keys()).map(
            (k) => k.endsWith('.py')
                ? k.substring(2).split('.py')[0]
                : k.substring(2).split('.js')[0],
        ),
        display: (title: string, htmlElement: HTMLElement) => {
            projectState.displayElement$.next({ title, htmlElement })
        },
        createOutputView: (
            name: string,
            htmlElement: HTMLElement
        ) => {
            projectState.requestOutputViewCreation({
                name,
                htmlElement,
            })
        },
    })
}
