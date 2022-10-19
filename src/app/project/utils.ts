import { Environment } from './project.state'
import { RawLog, View } from '../models'
import { VirtualDOM } from '@youwol/flux-view'

export function patchPythonSrc(fileName: string, originalSrc: string) {
    return `
import sys
from yw_pyodide import log_info, log_error, native_globals

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
for module_name in keys:
    if module_name not in nativeGlobals:
        del sys.modules[module_name]

${originalSrc}
`
}

export async function registerYwPyodideModule(
    environment: Environment,
    fileSystem: Map<string, string>,
    outputs: {
        onLog: (log: RawLog) => void
        onView: (view: View) => void
    },
) {
    environment.pyodide.registerJsModule('yw_pyodide', {
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
        native_globals: ['youwol_utils', ...environment.nativePythonGlobals],
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
    environment: Environment,
    fileSystem: Map<string, string>,
) {
    for (const key of Array.from(fileSystem.keys())) {
        const value = fileSystem.get(key)
        if (key.endsWith('.js')) {
            const jsModule = await new Function(value)()(window)
            const name = key.substring(2).split('.js')[0]
            environment.pyodide.registerJsModule(name, jsModule)
        }
    }
}

export async function syncFileSystem(
    environment: Environment,
    fileSystem: Map<string, string>,
) {
    environment.pyodide.FS.readdir('./')
        .filter((p) => !['.', '..'].includes(p))
        .forEach((p) => environment.pyodide.FS.unlink(p))

    fileSystem.forEach((value, path) => {
        path.endsWith('.py') &&
            environment.pyodide.FS.writeFile(path, value, {
                encoding: 'utf8',
            })
    })
}
