import { VirtualDOM } from '@youwol/flux-view'
import { MainThreadState } from '../main-thread'
import {
    LoadingScreenView,
    InstallDoneEvent,
    CdnMessageEvent,
} from '@youwol/cdn-client'

/**
 * @category View
 */
export class ProjectView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public class = 'w-100 h-100'
    /**
     * @group States
     */
    projectState: MainThreadState

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { projectState: MainThreadState }) {
        Object.assign(this, params)
        this.children = [
            {
                class: 'h-100 w-100',
                connectedCallback: (elem: HTMLDivElement) => {
                    const loadingScreen = new LoadingScreenView({
                        container: elem,
                        logo: `<div style='font-size:xxx-large'>🐍</div>`,
                        wrapperStyle: {
                            width: '100%',
                            height: '100%',
                            'font-weight': 'bolder',
                        },
                    })
                    loadingScreen.render()
                    this.projectState.cdnEvent$.subscribe((event) => {
                        if (event instanceof InstallDoneEvent) {
                            loadingScreen.next(
                                new CdnMessageEvent(
                                    'install-done',
                                    '🎉 Installation completed 🎉',
                                ),
                            )
                        }
                        loadingScreen.next(event)
                    })
                },
            },
        ]
    }
}
