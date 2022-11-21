import { RawLog, Requirements } from '../../models'
import { BehaviorSubject, from, merge, of, ReplaySubject, Subject } from 'rxjs'
import { map, mergeMap, scan, tap } from 'rxjs/operators'
import { OutputViewNode } from '../../explorer'
import { Environment, ExecutingImplementation } from '../environment.state'
import {
    cleanFileSystem,
    registerJsModules,
    registerPyPlayModule,
    registerYwPyodideModule,
    syncFileSystem,
} from '../in-worker-executable'
import { AppState } from '../../app.state'
import { CdnEvent, install } from '@youwol/cdn-client'

/**
 * @category State
 */
export class MainThreadImplementation implements ExecutingImplementation {
    /**
     *
     * @group States
     */
    public readonly appState: AppState

    /**
     * @group Observables
     */
    public readonly triggerOutputsCollect$ = new Subject<boolean>()

    /**
     * @group Observables
     */
    public readonly createdOutput$ = new ReplaySubject<OutputViewNode>(1)

    /**
     * @group Observables
     */
    public readonly createdOutputs$ = new BehaviorSubject<OutputViewNode[]>([])

    constructor({ appState }: { appState: AppState }) {
        this.appState = appState

        merge(this.triggerOutputsCollect$, this.createdOutput$)
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
    }

    installRequirements(
        requirements: Requirements,
        rawLog$: Subject<RawLog>,
        cdnEvent$: Subject<CdnEvent>,
    ) {
        const exportedPyodideInstanceName =
            Environment.ExportedPyodideInstanceName

        return from(
            install({
                ...requirements.javascriptPackages,
                customInstallers: [
                    {
                        module: '@youwol/cdn-pyodide-loader',
                        installInputs: {
                            modules: requirements.pythonPackages.map(
                                (p) => `@pyodide/${p}`,
                            ),
                            warmUp: true,
                            onEvent: (cdnEvent) => cdnEvent$.next(cdnEvent),
                            exportedPyodideInstanceName,
                        },
                    },
                ],
                onEvent: (cdnEvent) => {
                    cdnEvent$.next(cdnEvent)
                },
            }),
        ).pipe(
            map(() => {
                const pyodide = window[exportedPyodideInstanceName]

                Object.entries(requirements.javascriptPackages.aliases).forEach(
                    ([alias, originalName]) => {
                        rawLog$.next({
                            level: 'info',
                            message: `create alias '${alias}' to import '${originalName}' (version ${window[alias].__yw_set_from_version__}) `,
                        })
                        pyodide.registerJsModule(alias, window[alias])
                    },
                )
                const env = new Environment({
                    pyodide,
                })
                rawLog$.next({
                    level: 'info',
                    message: `Python ${env.pythonVersion.split('\n')[0]}`,
                })
                rawLog$.next({
                    level: 'info',
                    message: `Pyodide ${env.pyodideVersion}`,
                })
                return env
            }),
        )
    }

    initializeBeforeRun(
        fileSystem: Map<string, string>,
        rawLog$: Subject<RawLog>,
    ) {
        const outputs = {
            onLog: (log) => rawLog$.next(log),
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
                //syncFileSystem(pyodide, fileSystem),
            ]),
        )
    }

    execPythonCode(code: string, fileSystem: Map<string, string>) {
        this.triggerOutputsCollect$.next(true)
        const pyodide = self[Environment.ExportedPyodideInstanceName]
        return of(undefined).pipe(
            tap(() => {
                syncFileSystem(pyodide, fileSystem)
            }),
            mergeMap(() => {
                return pyodide.runPythonAsync(code)
            }),
            tap(() => {
                cleanFileSystem(pyodide, fileSystem)
            }),
        )
    }
}
