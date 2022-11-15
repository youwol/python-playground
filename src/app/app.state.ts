import {
    FilesBackend,
    ExplorerBackend,
    HTTPError,
    AssetsGateway,
    dispatchHTTPErrors,
} from '@youwol/http-clients'
import { BehaviorSubject, combineLatest, ReplaySubject } from 'rxjs'
import { Project } from './models'
import { ChildApplicationAPI } from '@youwol/os-core'
import { DockableTabs } from '@youwol/fv-tabs'
import { ProjectTab } from './side-nav-explorer'
import {
    debounceTime,
    map,
    mergeMap,
    skip,
    switchMap,
    tap,
} from 'rxjs/operators'
import { ProjectState } from './project'
import { OutputViewsTab } from './side-nav-explorer/output-views.tab'
import {
    createProjectRootNode,
    HelpersJsSourceNode,
    Node,
    OutputViewNode,
    PyWorkerNode,
    SourceNode,
    WorkerInputsNode,
    WorkerIONode,
    WorkerOutputsNode,
} from './explorer'
import { Explorer, PyWorkers } from '.'
import { logFactory } from './log-factory.conf'
import { PyWorkerState } from './py-workers/py-worker.state'

const log = logFactory().getChildLogger('app.state.ts')

/**
 *
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
    public readonly projectState: ProjectState

    /**
     * @group Immutable Constants
     */
    public readonly pyWorkersState$: BehaviorSubject<PyWorkerState[]>

    /**
     * @group Observables
     */
    public readonly openTabs$ = new BehaviorSubject<Node[]>([])

    /**
     * @group Observables
     */
    public readonly selectedTab$ = new BehaviorSubject<Node>(undefined)

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

        this.projectState = new ProjectState({
            project: params.project,
        })
        const initialWorkers = (params.project.pyWorkers || []).map(
            (pyWorker) => {
                return new PyWorkerState({ pyWorker })
            },
        )
        this.pyWorkersState$ = new BehaviorSubject<PyWorkerState[]>(
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

        this.projectState.projectLoaded$.subscribe((loaded) => {
            loaded
                ? rootNode.removeProcess(params.project.id)
                : rootNode.addProcess({
                      type: 'loading',
                      id: params.project.id,
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
        this.pyWorkersState$
            .pipe(
                switchMap((workers) => {
                    return combineLatest([
                        this.projectState.project$,
                        ...workers.map((w) => w.pyWorker$),
                    ])
                }),
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
                map(([project, ...workers]) => {
                    return {
                        ...project,
                        pyWorkers: workers,
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

    openTab(node: Node) {
        const noTabNodes = [
            WorkerIONode,
            WorkerInputsNode,
            WorkerOutputsNode,
            PyWorkerNode,
        ]
        if (noTabNodes.map((type) => node instanceof type).find((v) => v)) {
            return
        }
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
        const projectNode = this.explorerState.getNode(this.projectState.id)
        const workerNodes = projectNode
            .resolvedChildren()
            .filter((node) => node instanceof PyWorkerNode)
        const pyWorker = PyWorkers.getDefaultWorker({
            name: `Worker ${workerNodes.length}`,
        })
        const state = new PyWorkerState({ pyWorker })
        const node = new PyWorkerNode({
            pyWorker,
            state,
        })
        const actualWorkers = this.pyWorkersState$.getValue()
        this.pyWorkersState$.next([...actualWorkers, state])
        this.explorerState.addChild(this.projectState.id, node)
    }
}
