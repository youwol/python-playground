import { child$, VirtualDOM } from '@youwol/flux-view'

import { BehaviorSubject } from 'rxjs'

import {
    ConfigurationsNode,
    OutputViewNode,
    ProjectNode,
    RequirementsNode,
    SourceNode,
} from '../explorer'
import {ContentOutputView} from "./output.view";
import { ConfigurationsView } from './configurations.view'
import { ProjectView } from './project.view'
import { DockableTabs } from '@youwol/fv-tabs'
import { LogsTab } from './side-nav-tools'
import { SourceView } from './source.view'
import { RequirementsView } from './requirements.view'
import {AppState} from "../app.state";


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
    public readonly children: VirtualDOM[]

    constructor(params: { appState: AppState }) {
        Object.assign(this, params)

        this.children = [
            child$(
                this.appState.selected$,
                (selectedNode) => {
                    if (selectedNode instanceof ProjectNode) {
                        return new ProjectView({
                            projectState: this.appState.projectState,
                        })
                    }
                    if (selectedNode instanceof SourceNode) {
                        return new SourceView({
                            sourcePath: selectedNode.path,
                            projectState: this.appState.projectState,
                        })
                    }
                    if (selectedNode instanceof RequirementsNode) {
                        return new RequirementsView({
                            sourcePath: './requirements',
                            projectState: this.appState.projectState,
                        })
                    }
                    if (selectedNode instanceof ConfigurationsNode) {
                        return new ConfigurationsView({
                            sourcePath: './configurations',
                            projectState: this.appState.projectState,
                        })
                    }
                    if (selectedNode instanceof OutputViewNode) {
                        return new ContentOutputView({
                            view: selectedNode
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
    public readonly appState: AppState

    /**
     * @group Immutable DOM constants
     */
    public readonly class = 'h-100 flex-grow-1 d-flex flex-column position-relative'

    /**
     * @group Immutable DOM constants
     */
    public readonly style = {
        minWidth: '0px'
    }


    /**
     * @group Immutable DOM constants
     */
    public readonly children: VirtualDOM[]


    constructor(params: { appState: AppState }) {
        Object.assign(this, params)

        let sideNavView = new DockableTabs.View({
            state: new DockableTabs.State({
                disposition: 'bottom',
                viewState$: new BehaviorSubject<DockableTabs.DisplayMode>(
                    'pined',
                ),
                tabs$: new BehaviorSubject([
                    new LogsTab({ projectState: this.appState.projectState }),
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
