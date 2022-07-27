import { children$, VirtualDOM } from '@youwol/flux-view'
import { ProjectState } from '../project'
import { CodeEditorView, HeaderBannerView, HeaderBtnView } from './code-editor'
import { combineLatest } from 'rxjs'

/**
 * @category View
 */
export class SourceView implements VirtualDOM {
    /**
     * @group States
     */
    public readonly projectState: ProjectState

    /**
     * @group Immutable DOM constants
     */
    public readonly class = 'h-100'

    /**
     * @group Immutable DOM constants
     */
    public readonly children: VirtualDOM[]

    /**
     *
     * @group Immutable Constants
     */
    public readonly sourcePath: string

    constructor(params: { sourcePath: string; projectState: ProjectState }) {
        Object.assign(this, params)
        const run = () => {
            this.projectState.runCurrentConfiguration()
        }
        this.children = [
            new HeaderBannerView({
                children: [
                    {
                        class: 'ml-3 mr-2',
                        innerText: 'Configurations',
                    },
                    new ConfigurationsDropDown({
                        projectState: this.projectState,
                    }),
                    new HeaderBtnView({
                        projectState: this.projectState,
                        icon: 'fas fa-play',
                        onClick: run,
                    }),
                ],
            }),
            new CodeEditorView({
                sourcePath: this.sourcePath,
                projectState: this.projectState,
                onRun: run,
            }),
        ]
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
