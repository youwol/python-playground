import { VirtualDOM } from '@youwol/flux-view'
import { delay, withLatestFrom } from 'rxjs/operators'
import { Observable } from 'rxjs'
import { Common } from '@youwol/fv-code-mirror-editors'
import {
    EnvironmentState,
    ExecutingImplementation,
} from '../../environments/environment.state'

/**
 * @category View
 */
export class CodeEditorView {
    /**
     * @group States
     */
    public readonly state: EnvironmentState<ExecutingImplementation>

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
    public readonly refresh$: Observable<unknown>

    constructor(params: {
        sourcePath: Common.SourcePath
        state: EnvironmentState<ExecutingImplementation>
        onRun: () => void
        refresh$?: Observable<unknown>
    }) {
        Object.assign(this, params)
        const codeEditorView = new Common.CodeEditorView({
            ideState: this.state.ideState,
            path: this.sourcePath,
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
