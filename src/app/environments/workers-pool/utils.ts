import { getUrlBase, setup as cdnSetup } from '@youwol/cdn-client'
import { MessageEventData } from './workers-factory'
import { RawLog, Requirements } from '../../models'
import { Subject } from 'rxjs'
import { WorkerListener } from '../in-worker-executable'
import { Environment } from '../environment.state'
import { setup } from '../../../auto-generated'

export interface CdnEventWorker {
    text: string
    workerId: string
    id: string
}

export interface MessageCdnEventData {
    type: string
    workerId: string
    event: {
        id: string
        text: string
    }
}

export interface PythonStdOut {
    message: string
    workerId: string
}

export interface MessagePythonStdOutData {
    type: string
    workerId: string
    log: {
        message: string
    }
}

export interface MessageUserData {
    type: string
    workerId: string
    data: unknown
}

export function isCdnEventMessage(
    message: MessageEventData,
): undefined | CdnEventWorker {
    if (message.type != 'Data') {
        return undefined
    }
    const data = message.data as unknown as MessageCdnEventData
    if (data.type == 'CdnEvent') {
        return { ...data.event, workerId: data.workerId }
    }
    return undefined
}

export function isPythonStdOutMessage(
    message: MessageEventData,
): undefined | PythonStdOut {
    if (message.type != 'Data') {
        return undefined
    }
    const data = message.data as unknown as MessagePythonStdOutData
    if (data.type == 'PythonStdOut') {
        return { workerId: data.workerId, message: data.log.message }
    }
    return undefined
}

export function isUserDataMessage(
    message: MessageEventData,
): undefined | unknown {
    if (message.type != 'Data') {
        return undefined
    }
    const data = message.data as unknown as MessageUserData
    if (data.type == 'WorkerData') {
        return data.data
    }
    return undefined
}

export function dispatchWorkerMessage(
    message: MessageEventData,
    rawLog$: Subject<RawLog>,
    workerListener: WorkerListener,
) {
    const stdOut = isPythonStdOutMessage(message)
    if (stdOut) {
        rawLog$.next({
            level: 'info',
            message: `${stdOut.workerId}:${stdOut.message}`,
        })
        return
    }
    const userData = isUserDataMessage(message)
    if (userData) {
        workerListener.emit(userData)
        return
    }
}

export function objectPyToJs(pyodide, object) {
    const namespace = pyodide.toPy({ object })
    return pyodide.runPython(
        `
from pyodide.ffi import to_js
from js import Object
to_js(object, dict_converter= Object.fromEntries)
        `,
        {
            globals: namespace,
        },
    )
}

export function formatCdnDependencies(requirements: Requirements) {
    const cdnUrl = `${window.location.origin}${getUrlBase(
        '@youwol/cdn-client',
        cdnSetup.version,
    )}`
    return {
        cdnUrl,
        modules: [
            `rxjs#${setup.runTimeDependencies.externals.rxjs}`,
            ...requirements.javascriptPackages.modules,
        ],
        aliases: requirements.javascriptPackages.aliases,
        customInstallers: [
            {
                module: '@youwol/cdn-pyodide-loader',
                installInputs: {
                    modules: requirements.pythonPackages.map(
                        (p) => `@pyodide/${p}`,
                    ),
                    warmUp: true,
                    exportedPyodideInstanceName:
                        Environment.ExportedPyodideInstanceName,
                },
            },
        ],
    }
}
