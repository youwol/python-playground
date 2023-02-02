import { attr$, child$, VirtualDOM } from '@youwol/flux-view'
import {
    LoadingScreenView,
    InstallDoneEvent,
    CdnMessageEvent,
} from '@youwol/cdn-client'
import { BehaviorSubject, combineLatest } from 'rxjs'

import { AppState } from '../app.state'
import { Common } from '@youwol/fv-code-mirror-editors'

type Mode = 'dependencies' | 'raw-code'

/**
 * @category View
 */
export class ProjectView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public class = 'w-100 h-100 d-flex flex-column'
    /**
     * @group States
     */
    public readonly appState: AppState

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    /**
     * @group Observables
     */
    public readonly mode$ = new BehaviorSubject<Mode>('dependencies')

    constructor(params: { appState: AppState }) {
        Object.assign(this, params)
        this.children = [
            new ProjectHeaderView(this.mode$),
            child$(this.mode$, (mode) => {
                return {
                    class: 'flex-grow-1',
                    style: { minHeight: '0px' },
                    children: [
                        mode == 'dependencies'
                            ? new ProjectDependenciesView({
                                  appState: this.appState,
                              })
                            : new ProjectRawView({
                                  appState: this.appState,
                              }),
                    ],
                }
            }),
        ]
    }
}

/**
 * @category View
 */
export class ProjectHeaderView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'd-flex align-items-center p-2'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(selectedMode$: BehaviorSubject<Mode>) {
        this.children = [
            {
                class: attr$(
                    selectedMode$,
                    (mode): string =>
                        mode == 'dependencies' ? 'fv-text-focus' : '',
                    { wrapper: (d) => `${d} fas fa-cube fv-pointer` },
                ),
                onclick: () => selectedMode$.next('dependencies'),
            },
            { class: 'mx-2' },
            {
                class: attr$(
                    selectedMode$,
                    (mode): string =>
                        mode == 'raw-code' ? 'fv-text-focus' : '',
                    { wrapper: (d) => `${d} fas fa-code fv-pointer` },
                ),
                onclick: () => selectedMode$.next('raw-code'),
            },
        ]
    }
}

/**
 * @category View
 */
export class ProjectDependenciesView {
    /**
     * @group Immutable DOM Constants
     */
    public class = 'w-100 h-100'
    /**
     * @group States
     */
    public readonly appState: AppState
    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { appState: AppState }) {
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
                    this.appState.projectState.mainThreadState.cdnEvent$.subscribe(
                        (event) => {
                            if (event instanceof InstallDoneEvent) {
                                loadingScreen.next(
                                    new CdnMessageEvent(
                                        'install-done',
                                        '🎉 Installation completed 🎉',
                                    ),
                                )
                            }
                            loadingScreen.next(event)
                        },
                    )
                },
            },
        ]
    }
}

/**
 * @category View
 */
export class ProjectRawView {
    /**
     * @group Immutable DOM Constants
     */
    public class = 'w-100 h-100 overflow-auto'
    /**
     * @group States
     */
    public readonly appState: AppState
    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { appState: AppState }) {
        Object.assign(this, params)
        this.children = [
            child$(
                combineLatest([
                    this.appState.projectState.project$,
                    // The next one is to 'force' refresh upon tab selection
                    this.appState.selectedTab$,
                ]),
                ([project]) => {
                    const ideState = new Common.IdeState({
                        files: [
                            {
                                path: './raw-project.json',
                                content: JSON.stringify(project, null, 4),
                            },
                        ],
                        defaultFileSystem: Promise.resolve(new Map()),
                    })
                    return new Common.CodeEditorView({
                        ideState,
                        path: './raw-project.json',
                        language: 'javascript',
                    })
                },
            ),
        ]
    }
}
