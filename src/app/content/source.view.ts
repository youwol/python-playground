import { children$, VirtualDOM } from '@youwol/flux-view'
import { ProjectState } from '../project'
import { CodePageView } from './code-editor'
import { combineLatest } from 'rxjs'
import { WorkerBaseState } from '../worker-base.state'
import { AppState } from '../app.state'

/**
 * @category View
 */
export class SourceView extends CodePageView {
    constructor(params: {
        sourcePath: string
        state: WorkerBaseState
        appState: AppState
    }) {
        const run = () => {
            params.appState.projectState.runCurrentConfiguration()
        }
        super({
            ...params,
            headerView: {},
            onCtrlEnter: run,
        })
    }
}

/**
 * @category View
 */
export class ConfigurationsDropDown implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]
    constructor({ projectState }: { projectState: ProjectState }) {
        this.children = [
            {
                tag: 'select',
                onchange: (ev) => {
                    projectState.selectConfiguration(ev.target.value)
                },
                children: children$(
                    combineLatest([
                        projectState.configurations$,
                        projectState.selectedConfiguration$,
                    ]),
                    ([configurations, selectedName]) => {
                        return configurations.map((config) => {
                            return {
                                tag: 'option',
                                value: config.name,
                                innerText: config.name,
                                selected: config.name == selectedName,
                            }
                        })
                    },
                ),
            },
        ]
    }
}
