import { TopBannerView as TopBannerBaseView } from '@youwol/os-top-banner'
import { AppState } from '../app.state'

/**
 * @category View
 */
export class TopBannerView extends TopBannerBaseView {
    constructor({ appState }: { appState: AppState }) {
        super({
            innerView: {
                class: 'd-flex w-100 justify-content-center my-auto align-items-center',
                children: [
                    {
                        class: 'w-100 text-center',
                        innerText:
                            appState.assetInfo.fileInfo.metadata.fileName,
                    },
                ],
            },
        })
    }
}
