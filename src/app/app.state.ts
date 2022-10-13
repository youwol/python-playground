import {
    AssetsGateway,
    FilesBackend,
    ExplorerBackend,
    raiseHTTPErrors,
} from '@youwol/http-clients'
import {
    BehaviorSubject,
    combineLatest,
    from,
    Observable,
    ReplaySubject,
} from 'rxjs'
import { Project, Workspace } from './models'
import { ChildApplicationAPI } from '@youwol/os-core'
import { DockableTabs } from '@youwol/fv-tabs'
import { AllProjectsTab } from './side-nav-explorer'
import { map, mergeMap, shareReplay, skip, tap } from 'rxjs/operators'
import { install } from '@youwol/cdn-client'
import { ProjectState } from './project'

declare type CodeEditorModule = typeof import('@youwol/fv-code-mirror-editors')

/**
 * Lazy loading of the module `@youwol/fv-code-mirror-editors`
 *
 * @category HTTP
 */
export const loadFvCodeEditorsModule$: () => Observable<CodeEditorModule> =
    () =>
        from(
            install({
                modules: ['@youwol/fv-code-mirror-editors#^0.2.0'],
                scripts: ['codemirror#5.52.0~mode/python.min.js'],
                css: [
                    'codemirror#5.52.0~codemirror.min.css',
                    'codemirror#5.52.0~theme/blackboard.min.css',
                ],
                aliases: {
                    codeMirrorEditors: '@youwol/fv-code-mirror-editors',
                },
            }),
        ).pipe(
            map((window) => window['codeMirrorEditors'] as CodeEditorModule),
            shareReplay({ bufferSize: 1, refCount: true }),
        )

/**
 *
 * @category State
 */
export class AppState {
    static CodeEditorModule$ = loadFvCodeEditorsModule$()

    /**
     * Loaded workspace.
     *
     * @group Immutable Constants
     */
    public readonly workspace: Workspace

    /**
     * @group Immutable Constants
     */
    public readonly assetInfo: {
        fileInfo: FilesBackend.GetInfoResponse
        explorerInfo: ExplorerBackend.GetItemResponse
    }

    /**
     * @group Observables
     */
    public readonly selectedProject$ = new ReplaySubject<ProjectState>(1)

    /**
     * @group States
     */
    public readonly sideNavState: DockableTabs.State

    /**
     * @group Observables
     */
    public readonly projectsStateDict$: {
        [_k: string]: Observable<ProjectState>
    } = {}

    /**
     * @group Observables
     */
    public readonly allProjectsState$ = new BehaviorSubject<ProjectState[]>([])

    /**
     * @group Observables
     */
    public readonly workspace$: BehaviorSubject<Workspace>

    /**
     * @group Observables
     */
    public readonly projectsData$: { [k: string]: BehaviorSubject<Project> }

    constructor(params: {
        assetInfo: {
            fileInfo: FilesBackend.GetInfoResponse
            explorerInfo: ExplorerBackend.GetItemResponse
        }
        workspace: Workspace
    }) {
        Object.assign(this, params)
        this.sideNavState = new DockableTabs.State({
            disposition: 'left',
            viewState$: new BehaviorSubject<DockableTabs.DisplayMode>('pined'),
            tabs$: new BehaviorSubject([
                new AllProjectsTab({ appState: this }),
            ]),
            selected$: new BehaviorSubject<string>('AllProjects'),
        })

        ChildApplicationAPI.setProperties({
            snippet: {
                class: 'd-flex align-items-center px-1',
                children: [
                    {
                        class: '<i class="fab fa-python"></i> mr-1',
                    },
                    {
                        innerText: this.assetInfo.fileInfo.metadata.fileName,
                    },
                ],
            },
        })
        this.workspace$ = new BehaviorSubject<Workspace>(params.workspace)
        this.projectsData$ = params.workspace.projects.reduce((acc, e) => {
            return { ...acc, [e.id]: new BehaviorSubject(e) }
        }, {})
        combineLatest(Object.values(this.projectsData$)).subscribe(
            (projects) => {
                this.workspace$.next({ projects })
            },
        )
        this.workspace$
            .pipe(
                skip(1),
                mergeMap((workspace) => {
                    const filesClient = new AssetsGateway.Client().files
                    const str = JSON.stringify(workspace, null, 4)
                    const bytes = new TextEncoder().encode(str)
                    const blob = new Blob([bytes], {
                        type: 'application/json;charset=utf-8',
                    })
                    return filesClient.upload$({
                        body: {
                            fileName: this.assetInfo.fileInfo.metadata.fileName,
                            fileId: this.assetInfo.explorerInfo.rawId,
                            content: blob,
                        },
                        queryParameters: {
                            folderId: this.assetInfo.explorerInfo.folderId,
                        },
                    })
                }),
                raiseHTTPErrors(),
            )
            .subscribe((asset) => {
                console.log('Saved!', asset)
            })
    }

    selectProject(projectId: string) {
        const project = this.workspace$
            .getValue()
            .projects.find((p) => p.id == projectId)
        this.getOrCreateProjectState$(project).subscribe((projectState) => {
            this.selectedProject$.next(projectState)
        })
    }

    private getOrCreateProjectState$(
        project: Project,
    ): Observable<ProjectState> {
        if (this.projectsStateDict$[project.id]) {
            return this.projectsStateDict$[project.id]
        }
        this.projectsStateDict$[project.id] = AppState.CodeEditorModule$.pipe(
            map((module) => {
                return new ProjectState({
                    project,
                    CodeEditor: module,
                })
            }),
            tap((state) => {
                state.project$.subscribe((projectData) => {
                    this.projectsData$[projectData.id].next(projectData)
                })
                const projects = this.allProjectsState$.getValue()
                this.allProjectsState$.next([...projects, state])
            }),
            shareReplay({ bufferSize: 1, refCount: true }),
        )
        return this.projectsStateDict$[project.id]
    }
}
