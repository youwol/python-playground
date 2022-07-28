import { VirtualDOM, attr$, childrenWithReplace$ } from '@youwol/flux-view'
import { AppState } from './app.state'
import { TopBannerView } from './top-banner'
import { DockableTabs } from '@youwol/fv-tabs'
import { ContentView } from './content'
import { Carousel3dView, CarouselSide } from './carousel-3d'
import { BehaviorSubject } from 'rxjs'
import { filter, take } from 'rxjs/operators'

/**
 *
 * @category Getting Started
 * @category View
 */
export class AppView implements VirtualDOM {
    /**
     * @group States
     */
    public readonly appState: AppState

    /**
     * @group Immutable DOM Constants
     */
    public readonly class =
        'h-100 w-100 d-flex flex-column fv-text-primary fv-bg-background'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { appState: AppState }) {
        Object.assign(this, params)
        const selectedSide$ = new BehaviorSubject<CarouselSide>('front')
        const carousel = new Carousel3dView({
            frontView: new MainContentView({ appState: this.appState }),
            rightView: {},
            backView: {},
            leftView: {
                tag: 'iframe',
                width: '100%',
                height: '100%',
                src: attr$(
                    selectedSide$.pipe(
                        filter((d) => d != 'front'),
                        take(1),
                    ),
                    () => {
                        return '/applications/@youwol/stories/latest?id=68e053dd-6f16-4481-b141-af9047f3096f'
                    },
                ),
            },
            selectedSide$: selectedSide$,
        })
        document.addEventListener('keydown', logKey)

        function logKey(e) {
            if (e.altKey && e.key == 'ArrowUp') {
                e.preventDefault()
                selectedSide$.next('front')
            }
            if (e.altKey && e.key == 'ArrowDown') {
                e.preventDefault()
                selectedSide$.next('left')
            }
        }
        this.children = [
            new TopBannerView({ appState: this.appState }),
            {
                class: 'w-100 flex-grow-1',
                style: {
                    minHeight: '0px',
                },
                children: [carousel],
            },
        ]
    }
}

/**
 * @category View
 */
export class MainContentView implements VirtualDOM {
    /**
     * @group States
     */
    public readonly appState: AppState

    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'h-100 w-100 d-flex'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    /**
     * @group Immutable DOM Constants
     */
    public readonly style = {
        minHeight: '0px',
    }
    constructor(params: { appState: AppState }) {
        Object.assign(this, params)

        let sideNavView = new DockableTabs.View({
            state: this.appState.sideNavState,
            styleOptions: {
                initialPanelSize: '300px',
            },
        })

        this.children = [
            {
                class: 'w-100 flex-grow-1 d-flex position-relative',
                style: {
                    minHeight: '0px',
                },
                children: [
                    sideNavView,
                    {
                        class: 'flex-grow-1 h-100 fv-bg-background',
                        style: { minWidth: '0px' },
                        children: childrenWithReplace$(
                            this.appState.allProjectsState$,
                            (projectState) => {
                                return {
                                    class: attr$(
                                        this.appState.selectedProject$,
                                        (project) =>
                                            project.id == projectState.id
                                                ? 'h-100 w-100'
                                                : 'd-none',
                                    ),
                                    children: [
                                        new ContentView({
                                            projectState,
                                        }),
                                    ],
                                }
                            },
                        ),
                    },
                ],
            },
        ]
    }
}
