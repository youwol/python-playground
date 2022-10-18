import { TopBannerView as TopBannerBaseView } from '@youwol/os-top-banner'
import { AppState } from '../app.state'
import {ConfigurationsDropDown} from "../content";
import {VirtualDOM} from "@youwol/flux-view";


/**
 * @category View
 */
export class HeaderBtnView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'd-flex'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { icon: string; onClick: (ev) => void }) {
        Object.assign(this, params)

        this.children = [
            {
                class: 'ml-3 mr-2',
                children: [
                    {
                        class: 'fv-btn fv-pointer fv-text-success rounded fv-bg-background-alt fv-border fv-hover-xx-lighter py-0 px-1',
                        children: [
                            {
                                class: params.icon,
                            },
                        ],
                        onclick: params.onClick,
                    },
                ],
            },
        ]
    }
}


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
                        class:'rounded fv-bg-background-alt border d-flex align-items-center',
                        children:[
                            {
                                class: 'ml-3 mr-2',
                                innerText: 'Configurations',
                            },
                            new ConfigurationsDropDown({
                                projectState: appState.projectState,
                            }),
                            new HeaderBtnView({
                                icon: 'fas fa-play',
                                onClick: () => appState.projectState.runCurrentConfiguration(),
                            }),
                        ]
                    },
                    {
                        class:'flex-grow-1'
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
