import { DockableTabs } from '@youwol/fv-tabs'
import { AppState } from '../app.state'
import { child$, children$, VirtualDOM } from '@youwol/flux-view'
import { map } from 'rxjs/operators'
import { TreeView } from '../explorer'

/**
 * @category View
 */
export class AllProjectsTab extends DockableTabs.Tab {
    constructor({ appState }: { appState: AppState }) {
        super({
            id: 'AllProjects',
            title: 'All projects',
            icon: '',
            content: () => {
                return {
                    style: {
                        width: '300px',
                    },
                    children: [
                        new ProjectsDropDown({ appState }),
                        child$(appState.selectedProject$, (project) => {
                            return new TreeView({
                                state: project.explorerState,
                            })
                        }),
                    ],
                }
            },
        })
    }
}

/**
 * @category View
 */
export class ProjectsDropDown implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]
    constructor({ appState }: { appState: AppState }) {
        const projects$ = appState.workspace$.pipe(map((ws) => ws.projects))

        this.children = [
            {
                class: 'w-100',
                tag: 'select',
                onchange: (ev) => {
                    appState.selectProject(ev.target.value)
                },
                children: children$(projects$, (projects) => {
                    return [
                        {
                            tag: 'option',
                            innerText: '-- select a project --',
                        },
                        ...projects.map((project) => {
                            return {
                                tag: 'option',
                                value: project.id,
                                innerText: project.name,
                            }
                        }),
                    ]
                }),
            },
        ]
    }
}
