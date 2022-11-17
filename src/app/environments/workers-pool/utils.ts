import { fromFetch } from 'rxjs/fetch'
import { shareReplay } from 'rxjs/operators'
import { getUrlBase, setup as cdnSetup } from '@youwol/cdn-client'
import { MessageEventData } from './workers-factory'
import { RawLog } from '../../models'
import { Subject } from 'rxjs'
import { WorkerListener } from '../in-worker-executable'

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

export function getCdnClientSrc$() {
    const cdnUrl = getUrlBase('@youwol/cdn-client', cdnSetup.version)
    return fromFetch(cdnUrl, {
        selector: (response) => response.text(),
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }))
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
