import { VirtualDOM } from '@youwol/flux-view'
import { ProjectState } from '../../project'
/**
 * @category View
 */
export class CodeEditorView {
    /**
     * @group States
     */
    public readonly projectState: ProjectState

    /**
     * @group Immutable DOM constants
     */
    public readonly class = 'flex-grow-1 h-100'

    /**
     * @group Immutable DOM constants
     */
    public readonly children: VirtualDOM[]

    /**
     * @group Immutable constants
     */
    public readonly sourcePath: string

    constructor(params: {
        sourcePath: string
        projectState: ProjectState
        onRun: () => void
    }) {
        Object.assign(this, params)

        this.children = [
            new this.projectState.CodeEditorModule.Common.CodeEditorView({
                ideState: this.projectState.ideState,
                path: this.sourcePath,
                language: 'python',
                config: {
                    extraKeys: {
                        'Ctrl-Enter': () => {
                            params.onRun()
                        },
                    },
                },
            }),
        ]
    }
}
