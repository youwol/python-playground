import { fromFetch } from 'rxjs/fetch'
import { shareReplay } from 'rxjs/operators'
import { getUrlBase, setup as cdnSetup } from '@youwol/cdn-client'
import { MessageEventData } from './worker-pool'

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