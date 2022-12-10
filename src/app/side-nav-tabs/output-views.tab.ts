import { DockableTabs } from '@youwol/fv-tabs'
import { AppState } from '../app.state'
import { children$ } from '@youwol/flux-view'
import { OutputViewNode } from '../explorer'

/**
 * @category View
 */
export class OutputViewsTab extends DockableTabs.Tab {
    constructor({ appState }: { appState: AppState }) {
        super({
            id: 'Views',
            title: 'Views',
            icon: '',
            content: () => {
                return {
                    class: 'p-2',
                    style: {
                        width: '300px',
                    },
                    children: children$(
                        appState.projectState.mainThreadState
                            .executingImplementation.createdOutputs$,
                        (outputs) => {
                            return outputs.map((output) => {
                                const node = new OutputViewNode({
                                    projectState:
                                        appState.projectState.mainThreadState,
                                    name: output.name,
                                    htmlElement: output.htmlElement,
                                })
                                return {
                                    class: 'd-flex align-items-center fv-pointer fv-hover-bg-background-alt fv-border rounded',
                                    children: [
                                        {
                                            class: 'fas fa-code px-2',
                                        },
                                        {
                                            innerText: output.name,
                                        },
                                    ],
                                    onclick: () => {
                                        appState.openTab(node)
                                    },
                                }
                            })
                        },
                    ),
                }
            },
        })
    }
}
