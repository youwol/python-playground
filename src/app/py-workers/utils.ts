import { fromFetch } from 'rxjs/fetch'
import { shareReplay } from 'rxjs/operators'
import { getUrlBase, setup as cdnSetup } from '@youwol/cdn-client'

export function getCdnClientSrc$() {
    const cdnUrl = getUrlBase('@youwol/cdn-client', cdnSetup.version)
    return fromFetch(cdnUrl, {
        selector: (response) => response.text(),
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }))
}
