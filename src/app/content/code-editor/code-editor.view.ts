import { VirtualDOM } from '@youwol/flux-view'
import { delay, withLatestFrom } from 'rxjs/operators'
import { Observable } from 'rxjs'
import { Common } from '@youwol/fv-code-mirror-editors'
import { WorkerBaseState } from '../../worker-base.state'

/**
 * @category View
 */
export class CodeEditorView {
    /**
     * @group States
     */
    public readonly state: WorkerBaseState

    /**
     * @group Immutable DOM constants
     */
    public readonly class = 'w-100 h-100'

    /**
     * @group Immutable DOM constants
     */
    public readonly children: VirtualDOM[]

    /**
     * @group Immutable constants
     */
    public readonly sourcePath: Common.SourcePath

    /**
     * @group Observables
     */
    public readonly refresh$: Observable<any>

    constructor(params: {
        sourcePath: Common.SourcePath
        state: WorkerBaseState
        onRun: () => void
        refresh$?: Observable<any>
    }) {
        Object.assign(this, params)
        const codeEditorView = new Common.CodeEditorView({
            // I don't understand why any is needed on the next two lines: types definition seems correct
            ideState: this.state.ideState as any,
            path: this.sourcePath as any,
            language: this.sourcePath.endsWith('.py') ? 'python' : 'javascript',
            config: {
                extraKeys: {
                    'Ctrl-Enter': () => {
                        params.onRun()
                    },
                },
            },
        })
        codeEditorView.nativeEditor$.pipe(delay(10)).subscribe((cmEditor) => {
            cmEditor.refresh()
        })
        this.refresh$ &&
            this.refresh$
                .pipe(withLatestFrom(codeEditorView.nativeEditor$))
                .subscribe(([_, cmEditor]) => {
                    cmEditor.refresh()
                })
        this.children = [codeEditorView]
    }
}
