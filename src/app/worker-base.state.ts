import {
    BehaviorSubject,
    combineLatest,
    from,
    Observable,
    ReplaySubject,
    Subject,
} from 'rxjs'
import { Common } from '@youwol/fv-code-mirror-editors'
import { RawLog, Requirements, RunConfiguration, WorkerCommon } from './models'
import { CdnEvent } from '@youwol/cdn-client'
import { filter, map, mergeMap, skip, take } from 'rxjs/operators'
import {
    getModuleNameFromFile,
    patchPythonSrc,
    registerJsModules,
    registerYwPyodideModule,
    syncFileSystem,
} from './project'
import { installRequirements } from './load-project'
import { logFactory } from './log-factory.conf'

const log = logFactory().getChildLogger('worker-base.state.ts')
/**
 * @category Data Structure
 */
export class Environment {
    static ExportedPyodideInstanceName = 'loadedPyodide'

    /**
     * @group Immutable Constants
     */
    public readonly pyodide
    /**
     * @group Immutable Constants
     */
    public readonly pythonVersion: string
    /**
     * @group Immutable Constants
     */
    public readonly pyodideVersion: string
    /**
     * @group Immutable Constants
     */
    public readonly nativePythonGlobals: string[]

    constructor(params: { pyodide }) {
        Object.assign(this, params)
        this.pythonVersion = this.pyodide.runPython('import sys\nsys.version')
        this.pyodideVersion =
            window[Environment.ExportedPyodideInstanceName].version
        this.nativePythonGlobals = [
            ...this.pyodide
                .runPython(
                    'import sys\nfrom pyodide.ffi import to_js\nto_js(sys.modules)',
                )
                .keys(),
        ]
    }
}

/**
 * @category State
 */
export class WorkerBaseState {
    /**
     * @group Observables
     */
    public readonly environment$ = new ReplaySubject<Environment>(1)

    /**
     * @group Immutable Constants
     */
    public readonly id: string

    /**
     * @group States
     */
    public readonly ideState: Common.IdeState

    /**
     * @group Observables
     */
    public readonly requirements$ = new BehaviorSubject<Requirements>({
        pythonPackages: [],
        javascriptPackages: { modules: [], aliases: {} },
    })

    /**
     * @group Observables
     */
    public readonly configurations$ = new BehaviorSubject<RunConfiguration[]>(
        [],
    )

    /**
     * @group Observables
     */
    public readonly selectedConfiguration$ = new BehaviorSubject<string>(
        undefined,
    )

    /**
     * @group Observables
     */
    public readonly cdnEvent$ = new ReplaySubject<CdnEvent>()

    /**
     * @group Observables
     */
    public readonly projectLoaded$ = new BehaviorSubject(false)

    /**
     * @group Observables
     */
    public readonly rawLog$ = new ReplaySubject<RawLog>()

    /**
     * @group Observables
     */
    public readonly serialized$: Observable<WorkerCommon>

    /**
     * @group Observables
     */
    public readonly runStart$ = new Subject<true>()

    /**
     * @group Observables
     */
    public readonly runDone$ = new Subject<true>()

    constructor({ worker }: { worker: WorkerCommon }) {
        this.rawLog$.next({
            level: 'info',
            message: 'Welcome to the python playground 🐍',
        })

        this.id = worker.id

        log.info(`Initialize state for worker ${worker.id}`, () => {
            return worker.environment.requirements
        })
        const requirementsFile = {
            path: './requirements',
            content: JSON.stringify(worker.environment.requirements, null, 4),
        }
        const configurationsFile = {
            path: './configurations',
            content: JSON.stringify(worker.environment.configurations, null, 4),
        }
        this.configurations$.next(worker.environment.configurations)
        this.requirements$.next(worker.environment.requirements)
        this.selectedConfiguration$.next(
            worker.environment.configurations[0].name,
        )

        this.ideState = new Common.IdeState({
            files: [requirementsFile, configurationsFile, ...worker.sources],
            defaultFileSystem: Promise.resolve(new Map<string, string>()),
        })

        this.environment$.subscribe((env) => {
            this.rawLog$.next({
                level: 'info',
                message: `Python ${env.pythonVersion.split('\n')[0]}`,
            })
            this.rawLog$.next({
                level: 'info',
                message: `Pyodide ${env.pyodideVersion}`,
            })
        })

        this.installRequirements(worker.environment.requirements)
        this.serialized$ = combineLatest([
            this.requirements$,
            this.configurations$,
            this.ideState.fsMap$.pipe(filter((fsMap) => fsMap != undefined)),
        ]).pipe(
            skip(1),
            map(([requirements, configurations, fsMap]) => {
                return {
                    id: worker.id,
                    name: worker.name,
                    environment: {
                        requirements,
                        configurations,
                    },
                    sources: Array.from(fsMap.entries()).map(
                        ([name, content]) => {
                            return {
                                path: name,
                                content,
                            }
                        },
                    ),
                }
            }),
        )
    }

    removeFile(path: string) {
        this.ideState.removeFile(path)
        this.environment$.pipe(take(1)).subscribe(({ pyodide }) => {
            const moduleName = getModuleNameFromFile(path)
            pyodide.FS.unlink(path)
            pyodide.runPython(
                `import sys\n${moduleName} in sys.modules and del sys.modules[${moduleName}]`,
            )
        })
    }

    selectConfiguration(name: string) {
        this.selectedConfiguration$.next(name)
    }

    applyConfigurations() {
        combineLatest([this.selectedConfiguration$, this.ideState.fsMap$])
            .pipe(take(1))
            .subscribe(([configurationName, fileSystem]) => {
                const configurations = JSON.parse(
                    fileSystem.get('./configurations'),
                )
                const selected = configurations.find(
                    (conf) => conf.name == configurationName,
                )
                    ? configurationName
                    : configurations[0].name
                this.configurations$.next(configurations)
                this.selectedConfiguration$.next(selected)
            })
    }

    applyRequirements() {
        this.projectLoaded$.next(false)
        this.ideState.fsMap$.pipe(take(1)).subscribe((fileSystem) => {
            const requirements = JSON.parse(fileSystem.get('./requirements'))
            this.installRequirements(requirements)
            this.requirements$.next(requirements)
        })
    }

    runCurrentConfiguration(output: { onLog; onView }) {
        this.runStart$.next(true)
        combineLatest([
            this.environment$,
            this.configurations$,
            this.selectedConfiguration$,
            this.ideState.fsMap$,
        ])
            .pipe(
                take(1),
                mergeMap((params) =>
                    this.initializeBeforeRun([...params, output]),
                ),
            )
            .subscribe(
                ({
                    environment,
                    fileSystem,
                    configurations,
                    selectedConfigName,
                }) => {
                    const selectedConfig = configurations.find(
                        (config) => config.name == selectedConfigName,
                    )
                    const sourcePath = selectedConfig.scriptPath
                    const patchedContent = patchPythonSrc(
                        sourcePath,
                        fileSystem.get(sourcePath),
                    )
                    return environment.pyodide
                        .runPythonAsync(patchedContent)
                        .then(() => {
                            this.runDone$.next(true)
                        })
                },
            )
    }

    protected initializeBeforeRun([
        environment,
        configurations,
        selectedConfigName,
        fileSystem,
        outputs,
    ]) {
        return from(
            Promise.all([
                registerYwPyodideModule(environment, fileSystem, outputs),
                registerJsModules(environment, fileSystem),
                syncFileSystem(environment, fileSystem),
            ]),
        ).pipe(
            map(() => {
                return {
                    environment,
                    configurations,
                    selectedConfigName,
                    fileSystem,
                }
            }),
        )
    }

    private installRequirements(requirements: Requirements) {
        installRequirements({
            requirements,
            cdnEvent$: this.cdnEvent$,
            rawLog$: this.rawLog$,
            environment$: this.environment$,
        }).then(() => {
            this.projectLoaded$.next(true)
        })
    }
}