import { Project, RawLog, Requirements } from '../models'
import {
    BehaviorSubject,
    from,
    merge,
    Observable,
    ReplaySubject,
    Subject,
} from 'rxjs'
import { scan } from 'rxjs/operators'
import { OutputViewNode } from '../explorer'
import { Environment, WorkerBaseState } from '../worker-base.state'
import { installRequirements } from '../load-project'
import {
    registerJsModules,
    registerPyPlayModule,
    registerYwPyodideModule,
    syncFileSystem,
} from './utils'
import { AppState } from '../app.state'

/**
 * @category State
 */
export class MainThreadState extends WorkerBaseState {
    /**
     *
     * @group States
     */
    public readonly appState: AppState

    /**
     * @group Observables
     */
    public readonly project$: Observable<Project>

    /**
     * @group Observables
     */
    public readonly createdOutput$ = new ReplaySubject<OutputViewNode>(1)

    /**
     * @group Observables
     */
    public readonly createdOutputs$ = new BehaviorSubject<OutputViewNode[]>([])

    constructor({
        project,
        rawLog$,
        appState,
    }: {
        project: Project
        rawLog$: Subject<RawLog>
        appState: AppState
    }) {
        super({ worker: project, rawLog$ })
        this.appState = appState
        this.project$ = this.serialized$
        merge(this.runStart$, this.createdOutput$)
            .pipe(
                scan(
                    (acc, e: true | OutputViewNode) =>
                        e === true ? [] : [...acc, e],
                    [],
                ),
            )
            .subscribe((outputs) => {
                this.createdOutputs$.next(outputs)
            })

        this.installRequirements(project.environment.requirements)
    }

    installRequirements(requirements: Requirements) {
        installRequirements({
            requirements,
            cdnEvent$: this.cdnEvent$,
            rawLog$: this.rawLog$,
            environment$: this.environment$,
        }).then(() => {
            this.projectLoaded$.next(true)
        })
    }

    initializeBeforeRun(fileSystem: Map<string, string>) {
        const outputs = {
            onLog: (log) => this.rawLog$.next(log),
            onView: (view) => {
                const newNode = new OutputViewNode({
                    ...view,
                    projectState: this,
                })
                this.createdOutput$.next(newNode)
            },
            onData: () => {
                /*no op on main thread*/
            },
        }
        const pyodide = self[Environment.ExportedPyodideInstanceName]
        return from(
            Promise.all([
                registerYwPyodideModule(pyodide, fileSystem, outputs),
                registerPyPlayModule(pyodide, this.appState),
                registerJsModules(pyodide, fileSystem),
                syncFileSystem(pyodide, fileSystem),
            ]),
        )
    }

    execPythonSrc(patchedContent: string) {
        return self[Environment.ExportedPyodideInstanceName]
            .runPythonAsync(patchedContent)
            .then(() => {
                this.runDone$.next(true)
            })
    }
}
