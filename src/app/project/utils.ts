import { RawLog, View } from '../models'
import { VirtualDOM } from '@youwol/flux-view'

export function patchPythonSrc(fileName: string, originalSrc: string) {
    return `
import sys
from yw_pyodide import log_info, log_error, project_modules

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
keys = list(sys.modules.keys())
for module_name in project_modules:
    if module_name in sys.modules:
        del sys.modules[module_name]

${originalSrc}
`
}

export async function registerYwPyodideModule(
    pyodide,
    fileSystem: Map<string, string>,
    outputs: {
        onLog: (log: RawLog) => void
        onView: (view: View) => void
    },
) {
    pyodide.registerJsModule('yw_pyodide', {
        log_info: (message: string) => {
            message.trim() != '' &&
                outputs.onLog({
                    level: 'info',
                    message: message,
                })
        },
        log_error: (message: string) => {
            message.trim() != '' &&
                outputs.onLog({
                    level: 'error',
                    message: message,
                })
        },
        new: (T, ...p) => new T(...p),
        call: (obj: unknown, method: string, ...args) => obj[method](...args),
        project_modules: [...fileSystem.keys()].map((path) => {
            return self['getModuleNameFromFile'](path)
        }),
        create_view: (name: string, htmlElement: VirtualDOM | HTMLElement) => {
            outputs.onView({
                name,
                htmlElement,
            })
        },
        cdn_client: window['@youwol/cdn-client'],
    })
}

export async function registerJsModules(
    pyodide,
    fileSystem: Map<string, string>,
) {
    for (const key of Array.from(fileSystem.keys())) {
        const value = fileSystem.get(key)
        if (key.endsWith('.js')) {
            const jsModule = await new Function(value)()(window)
            const name = key.substring(2).split('.js')[0]
            pyodide.registerJsModule(name, jsModule)
        }
    }
}

export async function syncFileSystem(pyodide, fileSystem: Map<string, string>) {
    // No need to delete files: those are deleted explicitly from user's action 'delete file'
    fileSystem.forEach((value, path) => {
        path.endsWith('.py') &&
            pyodide.FS.writeFile(path, value, {
                encoding: 'utf8',
            })
    })
}

export function getModuleNameFromFile(path: string) {
    return path.replace('.js', '').replace('.py', '').replace('./', '')
}
