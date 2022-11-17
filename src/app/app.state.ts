import {
    FilesBackend,
    ExplorerBackend,
    HTTPError,
    AssetsGateway,
    dispatchHTTPErrors,
} from '@youwol/http-clients'
import {
    BehaviorSubject,
    combineLatest,
    from,
    Observable,
    ReplaySubject,
} from 'rxjs'
import { Project, RawLog, WorkersPool } from './models'
import { ChildApplicationAPI } from '@youwol/os-core'
import { DockableTabs } from '@youwol/fv-tabs'
import { ProjectTab } from './side-nav-explorer'
import {
    debounceTime,
    map,
    mergeMap,
    reduce,
    skip,
    switchMap,
    take,
    tap,
} from 'rxjs/operators'
import { MainThreadImplementation } from './environments/main-thread'
import { OutputViewsTab } from './side-nav-explorer/output-views.tab'
import {
    createProjectRootNode,
    HelpersJsSourceNode,
    Node,
    OutputViewNode,
    WorkersPoolNode,
    SourceNode,
} from './explorer'
import { Explorer } from '.'
import { logFactory } from './log-factory.conf'
import {
    getDefaultWorker,
    WorkersPoolImplementation,
} from './environments/workers-pool'
import {
    EnvironmentState,
    ExecutingImplementation,
} from './environments/environment.state'

const log = logFactory().getChildLogger('app.state.ts')

type MainThreadState = EnvironmentState<MainThreadImplementation>
type WorkersPoolState = EnvironmentState<WorkersPoolImplementation>
type AbstractEnvState = EnvironmentState<ExecutingImplementation>

/**
 * See https://github.com/pyodide/pyodide/blob/main/docs/usage/faq.md for eventual improvements
 *
 * Regarding interruption of e.g. running worker: https://pyodide.org/en/stable/usage/keyboard-interrupts.html
 * @category State
 */
export class AppState {
    /**
     * @group States
     */
    public readonly rightSideNavState: DockableTabs.State

    /**
     * @group States
     */
    public readonly leftSideNavState: DockableTabs.State

    /**
     * @group States
     */
    public readonly explorerState: Explorer.TreeState

    /**
     * @group Immutable Constants
     */
    public readonly projectState: MainThreadState

    /**
     * @group Immutable Constants
     */
    public readonly pyWorkersState$: BehaviorSubject<WorkersPoolState[]>

    /**
     * @group Observables
     */
    public readonly openTabs$ = new BehaviorSubject<Node[]>([])

    /**
     * @group Observables
     */
    public readonly selectedTab$ = new BehaviorSubject<Node>(undefined)

    /**
     * @group Observables
     */
    public readonly rawLog$ = new ReplaySubject<RawLog>()

    /**
     *
     * @group Observables
     */
    public readonly errors = {
        savingErrors$: new ReplaySubject<HTTPError>(1),
    }

    constructor(params: {
        project: Project
        fileInfo: FilesBackend.GetInfoResponse
        explorerInfo: ExplorerBackend.GetItemResponse
    }) {
        Object.assign(this, params)

        this.projectState = new EnvironmentState<MainThreadImplementation>({
            initialModel: params.project,
            rawLog$: this.rawLog$,
            executingImplementation: new MainThreadImplementation({
                appState: this,
            }),
        })
        const initialWorkers = (params.project.workersPools || []).map(
            (workersPool) => {
                return new EnvironmentState<WorkersPoolImplementation>({
                    initialModel: workersPool,
                    rawLog$: this.rawLog$,
                    executingImplementation: new WorkersPoolImplementation(),
                })
            },
        )
        this.pyWorkersState$ = new BehaviorSubject<WorkersPoolState[]>(
            initialWorkers,
        )

        const rootNode = createProjectRootNode(
            params.project,
            this.projectState,
            initialWorkers,
        )
        this.explorerState = new Explorer.TreeState({
            rootNode,
            appState: this,
        })
        const mergeWorkerBaseObs = (
            toObs: (state: AbstractEnvState) => Observable<unknown>,
        ) => {
            return this.pyWorkersState$.pipe(
                switchMap((workers) => {
                    return combineLatest([
                        toObs(this.projectState),
                        ...workers.map((w) => toObs(w)),
                    ])
                }),
            )
        }
        mergeWorkerBaseObs((state) =>
            state.projectLoaded$.pipe(map((loaded) => ({ loaded, state }))),
        ).subscribe((loadeds) => {
            loadeds.forEach(({ loaded, state }) => {
                const node = this.explorerState.getNode(state.id)
                loaded
                    ? node.removeProcess(params.project.id)
                    : node.addProcess({
                          type: 'loading',
                          id: params.project.id,
                      })
            })
        })

        this.leftSideNavState = new DockableTabs.State({
            disposition: 'left',
            viewState$: new BehaviorSubject<DockableTabs.DisplayMode>('pined'),
            tabs$: new BehaviorSubject([new ProjectTab({ appState: this })]),
            selected$: new BehaviorSubject<string>('Project'),
        })

        this.rightSideNavState = new DockableTabs.State({
            disposition: 'right',
            viewState$: new BehaviorSubject<DockableTabs.DisplayMode>(
                'collapsed',
            ),
            tabs$: new BehaviorSubject([
                new OutputViewsTab({ appState: this }),
            ]),
            selected$: new BehaviorSubject<string>('Views'),
        })
        this.explorerState.selectedNode$.subscribe((node) => {
            this.openTab(node)
        })

        this.projectState.runStart$.subscribe(() => {
            const toKeep = this.openTabs$.value.filter(
                (v) => !(v instanceof OutputViewNode),
            )
            this.openTabs$.next(toKeep)
            if (!toKeep.includes(this.selectedTab$.value)) {
                this.selectedTab$.next(toKeep[0])
            }
        })

        ChildApplicationAPI.setProperties({
            snippet: {
                class: 'd-flex align-items-center px-1',
                children: [
                    {
                        class: '<i class="fab fa-python"></i> mr-1',
                    },
                    {
                        innerText: params.explorerInfo.name,
                    },
                ],
            },
        })
        this.errors.savingErrors$.subscribe(() => {
            const projectNode = this.explorerState.getNode(params.project.id)
            projectNode.removeProcess('saving')
            projectNode.addProcess({
                type: 'errorSaving',
                id: 'errorSaving',
            })
        })
        mergeWorkerBaseObs((state) => state.serialized$)
            .pipe(
                skip(1),
                tap(() => {
                    const projectNode = this.explorerState.getNode(
                        params.project.id,
                    )
                    projectNode.removeProcess('errorSaving')
                    projectNode.addProcess({
                        type: 'saving',
                        id: 'saving',
                    })
                }),
                debounceTime(1000),
                map(([project, ...workers]: [Project, WorkersPool[]]) => {
                    return {
                        ...project,
                        workersPools: workers,
                    }
                }),
                mergeMap((project) => {
                    const filesClient = new AssetsGateway.Client().files
                    const str = JSON.stringify(project, null, 4)
                    const bytes = new TextEncoder().encode(str)
                    const blob = new Blob([bytes], {
                        type: 'application/json;charset=utf-8',
                    })
                    return filesClient.upload$({
                        body: {
                            fileName: params.fileInfo.metadata.fileName,
                            fileId: project.id,
                            content: blob,
                        },
                        queryParameters: {},
                    })
                }),
                dispatchHTTPErrors(this.errors.savingErrors$),
            )
            .subscribe(() => {
                const projectNode = this.explorerState.getNode(
                    params.project.id,
                )
                projectNode.removeProcess('saving')
                log.info('Project saved successfully')
            })
    }

    run() {
        this.pyWorkersState$
            .pipe(
                take(1),
                mergeMap((pyWorkers) => {
                    return from(pyWorkers)
                }),
                mergeMap((pyWorker) => {
                    return pyWorker.ideState.fsMap$.pipe(
                        take(1),
                        map((fsMap) => ({ fsMap, pyWorker })),
                    )
                }),
                mergeMap(({ fsMap, pyWorker }) => {
                    return pyWorker.executingImplementation.initializeBeforeRun(
                        fsMap,
                    )
                }),
                reduce((acc, e) => [...acc, e], []),
            )
            .subscribe(() => {
                this.projectState.run()
            })
    }

    openTab(node: Node) {
        log.info(`openTab: node ${node.name} (id=${node.id})`)
        const opened = this.openTabs$.value
        if (!opened.includes(node)) {
            this.openTabs$.next([...opened, node])
        }
        this.selectedTab$.next(node)
    }

    closeTab(node: Node) {
        log.info(`closeTab: node ${node.id}`)
        const opened = this.openTabs$.value.filter((v) => v != node)
        if (opened.length != this.openTabs$.value.length) {
            this.openTabs$.next(opened)
        }
        if (this.selectedTab$.value == node) {
            this.selectedTab$.next(opened[0])
        }
    }

    addFile(name: string, kind: 'js' | 'py') {
        log.info(`addFile: ${name} of kind ${kind}`)
        const path = `./${name}.${kind}`
        const factory = kind == 'js' ? HelpersJsSourceNode : SourceNode
        this.explorerState.addChild(
            this.projectState.id,
            new factory({
                path,
                state: this.projectState,
            }),
        )
        this.projectState.ideState.addFile({ path, content: '' })
    }

    deleteFile(path: string) {
        log.info(`deleteFile: ${path}`)
        const node = this.explorerState.getNode(path)
        this.explorerState.removeNode(path)
        this.projectState.removeFile(path)
        this.closeTab(node)
    }

    renameFile(node: SourceNode, name: string) {
        log.info(`renameFile: ${node.id} with name ${name}`)
        const factory = name.endsWith('.js') ? HelpersJsSourceNode : SourceNode
        const path = `./${name}`
        const newNode = new factory({ path, state: this.projectState })
        this.projectState.ideState.moveFile(node.id, `./${name}`)
        this.explorerState.replaceNode(
            node,
            new factory({ path, state: this.projectState }),
        )
        this.closeTab(node)
        this.openTab(newNode)
    }

    addPyWorker() {
        const pyWorker = getDefaultWorker({
            name: `Worker ${this.getWorkersPoolNodes().length}`,
        })
        const state = new EnvironmentState<WorkersPoolImplementation>({
            initialModel: pyWorker,
            rawLog$: this.rawLog$,
            executingImplementation: new WorkersPoolImplementation(),
        })
        const node = new WorkersPoolNode({
            pyWorker,
            state,
        })
        const actualWorkers = this.pyWorkersState$.getValue()
        this.pyWorkersState$.next([...actualWorkers, state])
        this.explorerState.addChild(this.projectState.id, node)
    }

    getPythonProxy() {
        return {
            get_worker_pool: (name: string) => {
                const id = this.getWorkersPoolNodes().find(
                    (node: WorkersPoolNode) => node.name == name,
                ).id
                const state = this.pyWorkersState$
                    .getValue()
                    .find((pool) => pool.id == id)

                return state.executingImplementation.getPythonProxy(
                    this.rawLog$,
                )
            },
        }
    }

    private getWorkersPoolNodes() {
        const projectNode = this.explorerState.getNode(this.projectState.id)
        return projectNode
            .resolvedChildren()
            .filter((node) => node instanceof WorkersPoolNode)
    }
}
