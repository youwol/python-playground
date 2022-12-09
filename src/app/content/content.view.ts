import {
    attr$,
    children$,
    childrenWithReplace$,
    VirtualDOM,
} from '@youwol/flux-view'

import { BehaviorSubject } from 'rxjs'

import {
    ConfigurationsNode,
    OutputViewNode,
    ProjectNode,
    RequirementsNode,
    SourceNode,
    Node,
    NodeView,
    WorkersPoolNode,
} from '../explorer'
import { ContentOutputView } from './output.view'
import { ConfigurationsView } from './configurations.view'
import { ProjectView } from './project.view'
import { DockableTabs } from '@youwol/fv-tabs'
import { LogsTab } from '../side-nav-tabs'
import { SourceView } from './source.view'
import { RequirementsView } from './requirements.view'
import { AppState } from '../app.state'
import { WorkerView } from './worker.view'

function viewFactory(node: Node, appState: AppState) {
    if (node instanceof ProjectNode) {
        return new ProjectView({
            mainThreadState: appState.mainThreadState,
        })
    }
    if (node instanceof SourceNode) {
        return new SourceView({
            sourcePath: node.path,
            state: node.state,
            appState,
        })
    }
    if (node instanceof RequirementsNode) {
        return new RequirementsView(node.state)
    }
    if (node instanceof ConfigurationsNode) {
        return new ConfigurationsView({
            sourcePath: './configurations',
            state: node.state,
        })
    }
    if (node instanceof OutputViewNode) {
        return new ContentOutputView({
            view: node,
        })
    }
    if (node instanceof WorkersPoolNode) {
        return new WorkerView({
            workerState: node.state,
        })
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
     * @group Immutable DOM constants
     */
    public readonly class =
        'main-content-view w-100 h-100 d-flex flex-column fv-bg-background'

    /**
     * @group Immutable DOM constants
     */
    public readonly children

    constructor(params: { appState: AppState }) {
        Object.assign(this, params)

        this.children = [
            new FilesHeaderView({ appState: this.appState }),
            {
                class: 'w-100 flex-grow-1',
                style: {
                    minHeight: '0px',
                },
                children: childrenWithReplace$(
                    this.appState.openTabs$,
                    (node) => {
                        const view = viewFactory(node, this.appState)
                        return {
                            class: attr$(
                                this.appState.selectedTab$,
                                (selected) =>
                                    selected == node ? 'w-100 h-100' : 'd-none',
                            ),
                            children: [view],
                        }
                    },
                ),
            },
        ]
    }
}

/**
 * @category View
 */
export class ContentView implements VirtualDOM {
    /**
     * @group States
     */
    public readonly appState: AppState

    /**
     * @group Immutable DOM constants
     */
    public readonly class =
        'h-100 flex-grow-1 d-flex flex-column position-relative'

    /**
     * @group Immutable DOM constants
     */
    public readonly style = {
        minWidth: '0px',
    }

    /**
     * @group Immutable DOM constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { appState: AppState }) {
        Object.assign(this, params)

        const sideNavView = new DockableTabs.View({
            state: new DockableTabs.State({
                disposition: 'bottom',
                viewState$: new BehaviorSubject<DockableTabs.DisplayMode>(
                    'pined',
                ),
                tabs$: new BehaviorSubject([
                    new LogsTab({
                        rawLog$: this.appState.rawLog$,
                    }),
                ]),
                selected$: new BehaviorSubject<string>('Logs'),
            }),
            styleOptions: {
                initialPanelSize: '300px',
            },
        })
        this.children = [
            {
                class: 'flex-grow-1 w-100',
                style: {
                    minHeight: '0px',
                },
                children: [
                    new MainContentView({
                        appState: this.appState,
                    }),
                ],
            },
            sideNavView,
        ]
    }
}

export class FilesHeaderView implements VirtualDOM {
    /**
     * @group States
     */
    public readonly appState: AppState

    /**
     * @group Immutable DOM constants
     */
    public readonly class: string = 'd-flex align-items-center w-100'

    /**
     * @group Immutable DOM constants
     */
    public readonly children

    constructor(params: { appState: AppState }) {
        Object.assign(this, params)
        this.children = children$(this.appState.openTabs$, (tabs) => {
            return tabs.map((tab) => {
                const parentWorker = this.appState.explorerState.getParent(
                    tab.id,
                )
                const prefix =
                    parentWorker instanceof WorkersPoolNode
                        ? `${parentWorker.name}:`
                        : ''
                return {
                    class: attr$(
                        this.appState.selectedTab$,
                        (selected): string =>
                            selected == tab
                                ? 'fv-text-focus fv-bg-background'
                                : 'fv-text-primary fv-bg-background-alt',
                        {
                            wrapper: (d) =>
                                `${d} border px-1 d-flex align-items-center px-2 fv-pointer fv-hover-xx-lighter`,
                        },
                    ),
                    children: [
                        {
                            class: NodeView.NodeTypeFactory[tab.category],
                        },
                        { class: 'mx-1' },
                        {
                            innerText: `${prefix}${tab.name}`,
                        },
                        { class: 'mx-1' },
                        {
                            class: 'fas fa-times fv-bg-background-alt rounded p-1 fv-hover-xx-lighter',
                            onclick: (ev: MouseEvent) => {
                                this.appState.closeTab(tab)
                                ev.stopPropagation()
                            },
                        },
                    ],
                    onclick: () => {
                        this.appState.openTab(tab)
                    },
                }
            })
        })
    }
}
