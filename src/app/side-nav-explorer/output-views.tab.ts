import { DockableTabs } from '@youwol/fv-tabs'
import { AppState } from '../app.state'
import {children$} from "@youwol/flux-view";

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
                        appState.projectState.createdOutputs$,
                        (outputs) => {
                            return outputs.map( output => {
                                return {
                                    class:'d-flex align-items-center fv-pointer fv-hover-bg-background-alt fv-border rounded',
                                    children:[
                                        {
                                            class:'fas fa-code px-2',
                                        },
                                        {
                                            innerText: output.name
                                        }
                                    ],
                                    onclick: () => {
                                        appState.openTab(output)
                                    }
                                }
                            })
                        }
                    )
                }
            },
        })
    }
}
