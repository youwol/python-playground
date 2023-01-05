import { TopBannerView as TopBannerBaseView } from '@youwol/os-top-banner'
import { AppState } from '../app.state'
import { children$, VirtualDOM } from '@youwol/flux-view'
import { combineLatest } from 'rxjs'
import { AbstractEnvState } from '../models'

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
export class ConfigurationSelectorView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class =
        'd-flex align-items-center rounded fv-bg-background-alt p-1'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    /**
     * @group Immutable Constants
     */
    public readonly onRun: () => void
    /**
     * @group State
     */
    public readonly state: AbstractEnvState

    constructor(params: { state: AbstractEnvState; onRun: () => void }) {
        Object.assign(this, params)

        this.children = [
            {
                class: 'ml-3 mr-2',
                innerText: 'Configurations',
            },
            new ConfigurationsDropDown({
                state: this.state,
            }),
            new HeaderBtnView({
                icon: 'fas fa-play',
                onClick: () => this.onRun(),
            }),
        ]
    }
}

/**
 * @category View
 */
export class PermissionsBadgeView implements VirtualDOM {
    public readonly class: string
    public readonly children: VirtualDOM[] = []

    constructor({ appState }: { appState: AppState }) {
        if (appState.projectInfo.permissionsInfo.write) {
            return
        }
        this.class =
            'd-flex rounded fv-bg-background-alt fv-text-focus mx-2 p-1 align-items-center'
        this.children = [
            {
                class: 'fas fa-lock',
            },
            { class: 'px-1' },
            {
                innerText: 'No write permissions',
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
                    new PermissionsBadgeView({ appState }),
                    {
                        class: 'flex-grow-1 d-flex justify-content-center',
                        children: [
                            new ConfigurationSelectorView({
                                state: appState.projectState.mainThreadState,
                                onRun: () => appState.run(),
                            }),
                        ],
                    },
                    {
                        tag: 'a',
                        href: '/applications/@youwol/stories/latest?id=1b1d6ff1-9dad-4a1f-951a-5bd362e0ee53&mode=reader',
                        class: 'mx-3 fas fa-question fv-text-focus p-1 fv-pointer rounded fv-hover-bg-background-alt',
                        target: '_blank',
                    },
                ],
            },
        })
    }
}

/**
 * @category View
 */
export class ConfigurationsDropDown implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor({ state }: { state: AbstractEnvState }) {
        this.children = [
            {
                tag: 'select',
                onchange: (ev) => {
                    state.selectConfiguration(ev.target.value)
                },
                children: children$(
                    combineLatest([
                        state.configurations$,
                        state.selectedConfiguration$,
                    ]),
                    ([configurations, selectedName]) => {
                        return configurations.map((config) => {
                            return {
                                tag: 'option',
                                value: config.name,
                                innerText: config.name,
                                selected: config.name == selectedName,
                            }
                        })
                    },
                ),
            },
        ]
    }
}
