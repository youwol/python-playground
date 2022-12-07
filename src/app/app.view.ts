import { VirtualDOM } from '@youwol/flux-view'
import { AppState } from './app.state'
import { TopBannerView } from './top-banner'
import { DockableTabs } from '@youwol/fv-tabs'
import { ContentView } from './content'

/**
 *
 * @category Getting Started
 * @category View
 */
export class AppView implements VirtualDOM {
    /**
     * @group States
     */
    public readonly appState: AppState

    /**
     * @group Immutable DOM Constants
     */
    public readonly class =
        'h-100 w-100 d-flex flex-column fv-text-primary fv-bg-background'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { appState: AppState }) {
        Object.assign(this, params)


        this.children = [
            new TopBannerView({ appState: this.appState }),
            {
                class: 'w-100 flex-grow-1',
                style: {
                    minHeight: '0px',
                },
                children: [new MainContentView({appState: this.appState})],
            },
        ]
    }
}

/**
 * @category View
 */
export class MainContentView implements VirtualDOM {
    /**
     * @group States
     */
    public readonly appState: AppState

    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'h-100 w-100 d-flex'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    /**
     * @group Immutable DOM Constants
     */
    public readonly style = {
        minHeight: '0px',
    }
    constructor(params: { appState: AppState }) {
        Object.assign(this, params)

        const leftSideNavView = new DockableTabs.View({
            state: this.appState.leftSideNavState,
            styleOptions: {
                initialPanelSize: '300px',
            },
        })
        const rightSideNavView = new DockableTabs.View({
            state: this.appState.rightSideNavState,
            styleOptions: {
                initialPanelSize: '300px',
            },
        })
        this.children = [
            {
                class: 'w-100 flex-grow-1 d-flex position-relative',
                style: {
                    minHeight: '0px',
                },
                children: [
                    leftSideNavView,
                    new ContentView({
                        appState: this.appState,
                    }),
                    rightSideNavView
                ],
            },
        ]
    }
}
