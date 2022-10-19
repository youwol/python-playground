import {
    AssetsGateway,
    raiseHTTPErrors,
    FilesBackend,
} from '@youwol/http-clients'
import { BehaviorSubject } from 'rxjs'
import { Project } from './models'
import { ChildApplicationAPI } from '@youwol/os-core'
import { DockableTabs } from '@youwol/fv-tabs'
import { ProjectTab } from './side-nav-explorer'
import { mergeMap, skip } from 'rxjs/operators'
import { ProjectState } from './project'
import { OutputViewsTab } from './side-nav-explorer/output-views.tab'
import {
    HelpersJsSourceNode,
    Node,
    OutputViewNode,
    SourceNode,
} from './explorer'
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
     * @group Immutable Constants
     */
    public readonly projectState: ProjectState

    /**
     * @group Immutable Constants
     */
    public readonly fileInfo: FilesBackend.GetInfoResponse

    /**
     * @group Observables
     */
    public readonly openTabs$ = new BehaviorSubject<Node[]>([])

    /**
     * @group Observables
     */
    public readonly selectedTab$ = new BehaviorSubject<Node>(undefined)

    constructor(params: {
        project: Project
        fileInfo: FilesBackend.GetInfoResponse
    }) {
        Object.assign(this, params)

        this.projectState = new ProjectState({
            project: params.project,
            appState: this,
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
        this.projectState.explorerState.selectedNode$.subscribe((node) => {
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
                        innerText: this.fileInfo.metadata.fileName,
                    },
                ],
            },
        })
        this.projectState.project$
            .pipe(
                skip(1),
                mergeMap((project) => {
                    const filesClient = new AssetsGateway.Client().files
                    const str = JSON.stringify(project, null, 4)
                    const bytes = new TextEncoder().encode(str)
                    const blob = new Blob([bytes], {
                        type: 'application/json;charset=utf-8',
                    })
                    return filesClient.upload$({
                        body: {
                            fileName: this.fileInfo.metadata.fileName,
                            fileId: project.id,
                            content: blob,
                        },
                        queryParameters: {},
                    })
                }),
                raiseHTTPErrors(),
            )
            .subscribe((asset) => {
                console.log('Saved!', asset)
            })
    }

    openTab(node: Node) {
        const opened = this.openTabs$.value
        if (!opened.includes(node)) {
            this.openTabs$.next([...opened, node])
        }
        this.selectedTab$.next(node)
    }

    closeTab(node: Node) {
        const opened = this.openTabs$.value.filter((v) => v != node)
        if (opened.length != this.openTabs$.value.length) {
            this.openTabs$.next(opened)
        }
        if (this.selectedTab$.value == node) {
            this.selectedTab$.next(opened[0])
        }
    }

    addFile(name: string, kind: 'js' | 'py') {
        const path = `./${name}.${kind}`
        const factory = kind == 'js' ? HelpersJsSourceNode : SourceNode
        this.projectState.explorerState.addChild(
            this.projectState.id,
            new factory({
                path,
                projectState: this.projectState,
            }),
        )
        this.projectState.ideState.addFile({ path, content: '' })
    }

    deleteFile(path: string) {
        const node = this.projectState.explorerState.getNode(path)
        this.projectState.explorerState.removeNode(path)
        this.projectState.ideState.removeFile(path)
        this.closeTab(node)
    }

    renameFile(node: SourceNode, name: string) {
        const factory = name.endsWith('.js') ? HelpersJsSourceNode : SourceNode
        const path = `./${name}`
        const newNode = new factory({ path, projectState: this.projectState })
        this.projectState.ideState.moveFile(node.id, `./${name}`)
        this.projectState.explorerState.replaceNode(
            node,
            new factory({ path, projectState: this.projectState }),
        )
        this.closeTab(node)
        this.openTab(newNode)
    }
}
