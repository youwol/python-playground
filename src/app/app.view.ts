import {
    Stream$,
    VirtualDOM,
    attr$,
    childrenWithReplace$,
} from '@youwol/flux-view'
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
        'h-100 w-100 d-flex flex-column fv-text-primary position-relative'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    /**
     * @group Immutable DOM Constants
     */
    public readonly style: Stream$<
        { [_key: string]: string },
        { [_key: string]: string }
    >

    constructor(params: { appState: AppState }) {
        Object.assign(this, params)

        let sideNavView = new DockableTabs.View({
            state: this.appState.sideNavState,
            styleOptions: {
                initialPanelSize: '300px',
            },
        })
        this.children = [
            new TopBannerView({ appState: this.appState }),
            {
                class: 'w-100 flex-grow-1 d-flex position-relative',
                style: {
                    minHeight: '0px',
                },
                children: [
                    sideNavView,
                    {
                        class: 'w-100 h-100',
                        children: childrenWithReplace$(
                            this.appState.allProjectsState$,
                            (projectState) => {
                                return {
                                    class: attr$(
                                        this.appState.selectedProject$,
                                        (project) =>
                                            project.id == projectState.id
                                                ? 'h-100'
                                                : 'd-none',
                                    ),
                                    children: [
                                        new ContentView({
                                            appState: this.appState,
                                            projectState,
                                        }),
                                    ],
                                }
                            },
                        ),
                    },
                ],
            },
        ]
    }
}
