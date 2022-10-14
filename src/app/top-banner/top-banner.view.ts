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
                    {
                        tag: 'a',
                        href: '/applications/@youwol/stories/latest?id=9ad4ef57-182a-40a6-a5ba-17d0d3bbf47b&mode=reader',
                        class: 'mx-3 fas fa-question fv-text-focus p-1 fv-pointer rounded fv-hover-bg-background-alt',
                        target: '_blank',
                    },
                ],
            },
        })
    }
}
