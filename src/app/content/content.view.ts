import { child$, VirtualDOM } from '@youwol/flux-view'

import { BehaviorSubject } from 'rxjs'

import {
    ConfigurationsNode,
    OutputViewNode,
    ProjectNode,
    RequirementsNode,
    SourceNode,
} from '../explorer'
import { ConfigurationsView } from './configurations.view'
import { ProjectView } from './project.view'
import { ProjectState } from '../project'
import { DockableTabs } from '@youwol/fv-tabs'
import { LogsTab } from './side-nav-tools'
import { SourceView } from './source.view'
import { RequirementsView } from './requirements.view'

import { distinctUntilChanged, filter } from 'rxjs/operators'

/**
 * @category View
 */
export class MainContentView implements VirtualDOM {
    /**
     * @group States
     */
    public readonly projectState: ProjectState

    /**
     * @group Immutable DOM constants
     */
    public readonly class =
        'main-content-view w-100 h-100 d-flex flex-column fv-bg-background'

    /**
     * @group Immutable DOM constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { projectState: ProjectState }) {
        Object.assign(this, params)

        this.children = [
            child$(
                this.projectState.explorerState.selectedNode$.pipe(
                    distinctUntilChanged((nodePrev, nodeCurrent) => {
                        if (nodePrev.id == nodeCurrent.id) return true
                        return (
                            nodePrev instanceof OutputViewNode &&
                            nodeCurrent.children &&
                            nodeCurrent.resolvedChildren().includes(nodePrev)
                        )
                    }),
                    filter((node) => !(node instanceof OutputViewNode)),
                ),
                (selectedNode) => {
                    if (selectedNode instanceof ProjectNode) {
                        return new ProjectView({
                            projectState: this.projectState,
                        })
                    }
                    if (selectedNode instanceof SourceNode) {
                        return new SourceView({
                            sourcePath: selectedNode.path,
                            projectState: this.projectState,
                        })
                    }
                    if (selectedNode instanceof RequirementsNode) {
                        return new RequirementsView({
                            sourcePath: './requirements',
                            projectState: this.projectState,
                        })
                    }
                    if (selectedNode instanceof ConfigurationsNode) {
                        return new ConfigurationsView({
                            sourcePath: './configurations',
                            projectState: this.projectState,
                        })
                    }
                    return {}
                },
            ),
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
    public readonly projectState: ProjectState

    /**
     * @group Immutable DOM constants
     */
    public readonly class = 'w-100 h-100 d-flex flex-column position-relative'

    /**
     * @group Immutable DOM constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { projectState: ProjectState }) {
        Object.assign(this, params)

        let sideNavView = new DockableTabs.View({
            state: new DockableTabs.State({
                disposition: 'bottom',
                viewState$: new BehaviorSubject<DockableTabs.DisplayMode>(
                    'pined',
                ),
                tabs$: new BehaviorSubject([
                    new LogsTab({ projectState: this.projectState }),
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
                        projectState: this.projectState,
                    }),
                ],
            },
            sideNavView,
        ]
    }
}
