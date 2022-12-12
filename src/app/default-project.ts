import { v4 as uuidv4 } from 'uuid'

export const defaultProject = {
    name: 'Project',
    environment: {
        requirements: {
            pythonPackages: ['numpy'],
            javascriptPackages: {
                modules: [
                    'd3#^5.15.0',
                    '@youwol/flux-view#^1.0.3',
                    'chart.js#^3.9.1',
                ],
                aliases: {
                    flux_view: '@youwol/flux-view',
                    rxjs: 'rxjs',
                    chartJs: 'chart.js',
                },
            },
        },
        configurations: [
            {
                name: 'default',
                scriptPath: './main.py',
                parameters: '',
            },
        ],
    },
    sources: [
        {
            path: './main.py',
            content: `
from pyodide.ffi import create_proxy
import numpy as np
from plot import create_chart, to_js
from py_flux_view import render, attr

from rxjs import timer, BehaviorSubject, combineLatest
from rxjs.operators import map

from datetime import datetime
from yw_pyodide import create_view

draws_size = (100,2)
proxies_buffer = []

mean = 0
sigma = 0.1


def on_disconnected(_):
    print(f'Proxies buffered destroyed ({len(proxies_buffer)})')
    [proxy.destroy() for proxy in proxies_buffer]      

chart = None

def draw_sample(event):
    global chart
    print('Draw sample')
    chart.data.datasets[0].data = to_js(np.random.normal(mean, sigma, draws_size))
    chart.update()


def make_chart(html_element):
    global chart
    chart = create_chart(html_element,  np.random.normal(mean, sigma, draws_size))     
    

vdom = { 
    "class": "w-50 h-50 text-center p-5 mx-auto",        
    "children":[
        {
            "innerText": attr(
                timer(0,1000),
                lambda count, _: f"{datetime.today().strftime('%Y-%m-%d %H:%M:%S')}",
                proxies_buffer
            )
        },
        {
            "class": "border rounded fv-bg-background-alt fv-hover-xx-lighter fv-pointer my-2 p-1 mx-auto",
            "style": {
                "width": "fit-content"
            },
            "innerText": "Draw new sample",
            "onclick": draw_sample
        },
        {
            "tag":'canvas',
            "connectedCallback": make_chart         
        }
    ],
    "disconnectedCallback": on_disconnected
}

create_view("test", to_js(vdom))
`,
        },
        {
            path: './plot.py',
            content: `
from pyodide.ffi import to_js as to_js_0
from typing import Iterable, Tuple
from js import Object
import chartJs


chartJs.Chart.register(*chartJs.registerables);

def create_chart(html_element, samples: Iterable[Tuple[float, float]]) -> chartJs.Chart:
    
    data = {    
        "datasets": [{
            "label": 'Dataset',
            "backgroundColor": 'rgb(255, 99, 132)',
            "borderColor": 'rgb(255, 99, 132)',
            "data": samples,
        }]
    }

    config = {
        "type": 'scatter',
        "data": data
    }
    
    return chartJs.Chart.new(
        html_element,
        to_js(config)
    )   
    
def to_js(obj):
    return to_js_0(obj, dict_converter= Object.fromEntries)
            `,
        },
        {
            path: './py_flux_view.py',
            content: `
from pyodide.ffi import create_proxy, to_js
import flux_view
from yw_pyodide import call

from js import Object

def attr(domain_observable, vdom_mapper, proxies_buffer):
    vdom_proxy = create_proxy(vdom_mapper)
    proxies_buffer.append(vdom_proxy)
    return call(flux_view, 'attr$', domain_observable, vdom_proxy)

def render(vdom):
    return flux_view.render(to_js(vdom, dict_converter= Object.fromEntries))
`,
        },
        {
            path: './helpers_js.js',
            content: `
return async () => { 
    return {
    }
}
`,
        },
        /*{
            path: './main.py',
            content:
                'from js import Object, document\n# import script has side-effects! => define flux_view.attr & flux_view.child from corresponding functions\nimport script\nfrom script import to_js\nfrom youwol_utils import createOutputView\nfrom flux_view import render, attr, child, childrenAppendOnly\nfrom rxjs import timer, BehaviorSubject, Subject, operators\nfrom datetime import datetime\nfrom plotly import newPlot\nimport plotly\nimport numpy as np\nfrom typing import Any\nfrom pyodide import create_proxy, to_js as to_js_0, create_once_callable\nfrom pyodide.http import pyfetch\nimport sklearn\nwindow=await script.install_all()\n\n#-----------------------\n# Reactivity at simplest\n#-----------------------\n\nvirtualDom = {\n   "innerText":attr(\n       timer(0,1000), \n       lambda count, _: f"Reactivity at simplest, it is : {datetime.today().strftime(\'%Y-%m-%d %H:%M:%S\')}") \n}\ncreateOutputView("Reactivity at simplest", to_js(virtualDom), __file__)\n\n#------------------------------\n# Definition of a \'logger\' view\n#------------------------------\n\nlogs_stream = Subject.new()\n\ncreateOutputView(\n    "Simple example with rxjs", \n    to_js(\n        {\n            "class":\'p-5 fv-bg-background-alt\',\n            "children":[\n                {\n                    "tag":\'h2\',\n                    "innerText": f"Outputs2 generated at {datetime.today().strftime(\'%Y-%m-%d %H:%M:%S\')}"\n                },\n                {\n                    "class":"p-2 rounded border fv-text-focus",\n                    "children": [virtualDom]\n                },\n                {\n                    "children": childrenAppendOnly(\n                        logs_stream.pipe( operators.map( create_proxy(lambda e, _: to_js([e])))),\n                        lambda e: e\n                    )\n                }\n            ]\n        }\n    ),\n    __file__\n)\n\nlogs_stream.next({"innerText":"coucou"})\n\n\n#-----------------------\n# Want a plot?\n#-----------------------\n\ndiv = document.createElement(\'div\')\ndata = {\n    \'x\': [1,2,3,4,5,6,7,8,9,10],\n    \'y\': np.random.random_sample((10,)),\n    \'mode\': \'lines+markers\',\n    \'type\': \'scatter\'\n}\nnewPlot(div, to_js([data]))\n\n\nlogs_stream.next({"children":[{"tag": "h2", "innerText": \'Want a plot?\'}, div]})\n#-----------------------\n# Want interactivity?\n#-----------------------\n\nsource_obs = BehaviorSubject.new(to_js(np.random.random_sample((5,))))\n        \ndef create_plot_view(y_data):\n    src = {**data,\'y\':y_data}\n    def new_plot(elem):\n        newPlot(\n            elem, \n            to_js([{**data,\'y\':y_data}]), \n            to_js({"title":{"text":f"Sum: {sum(y_data)}"}})\n        )\n                \n    return to_js({   \n        "class": "fv-bg-background-alt border",\n        "style":{"width": "500px", "height":"500px"},\n        "connectedCallback": new_plot\n    })\n\ni = 0\ndef on_click(ev):\n    global i\n    createOutputView(f"Creation differed {i}", to_js(virtualDom), __file__)\n    source_obs.next(to_js(np.random.random_sample((5,))))\n    i = i + 1\n    \non_click_pxy = create_proxy(on_click)\ncreate_plot_view_pxy = create_proxy(create_plot_view)\n\ndef on_disconnected(_e):\n    print(\'disconnected\')\n    [px.destroy() for px in [on_click_pxy, create_plot_view_pxy]]\n\nvirtualDom = { \n    "children":[\n        {\n            "class":\'border rounded fv-bg-background-alt fv-hover-xx-ligter fv-pointer fas fa-play p-1\',\n            "onclick": on_click_pxy\n        },\n        child(\n            source_obs,\n            create_plot_view_pxy\n        )                                                           \n    ],\n    "disconnectedCallback": on_disconnected\n}\n\n\nlogs_stream.next(virtualDom)\nlogs_stream.next({"innerText":"guigui"})\n#-----------------------\n# IO?\n#-----------------------\n\nresponse = await pyfetch(\n    url="/api/assets-gateway/files-backend/files/ccb4310e-60fc-402f-9114-fed616308cb7",\n)\ndata = await response.json()\n\ndiv = document.createElement(\'div\')\ndata = {\n    **data,\n    \'mode\': \'lines+markers\',\n    \'type\': \'scatter\'\n}\nnewPlot(div, to_js([data]))\n\nlogs_stream.next({"children":[{"tag": "h2", "innerText": \'from IO\'}, div]})\n\n',
        },
        {
            path: './plot.py',
            content:
                "from youwol_utils import call\nfrom js import Object\nimport asyncio\nfrom cdn_client import install\nimport flux_view\nfrom pyodide import create_proxy\nfrom pyodide import create_proxy, to_js as to_js_0\nfrom youwol_utils import display, createOutputView\n\njeeze=5\n\nflux_view.attr = lambda a,b: call(flux_view, 'attr$', a, create_proxy(b)) \n\nflux_view.child = lambda a,b: call(flux_view, 'child$', a, create_proxy(b)) \n  \nflux_view.childrenAppendOnly = lambda a,b: call(flux_view, 'childrenAppendOnly$', a, create_proxy(b)) \n  \ndef to_js(obj):\n    return to_js_0(obj, dict_converter= Object.fromEntries)\n\nasync def install_all():\n    createOutputView(\"Dummy3\", to_js({\"innerText\":\"toto\"}), __file__)\n    return await install(to_js({'modules':['@youwol/flux-view'],'aliases':{'flux_view':'@youwol/flux-view'}},))",
        },*/
    ],
}

export const defaultWorkerSrc = `
"""
Approximate the value op Pi from random draws in a 1*1 squares.
Approximation gets better with the number of samples drawn.

The following snippet is an example on how to trigger the computation from the main thread:
'
from python_playground.main_thread import application
from python_playground.main_thread.worker import Listener

# make sure a 'Workers-pool 0' exists in your project, required 'numpy' dependency.
worker_pool = application.get_worker_pool('Workers-pool 0')
print("Reserve workers")
# This is how you can scale dynamically the workers-pool
await worker_pool.reserve(1)
print("Reservation done")

task = {
    "title": "approximate pi value", 
    "entryPoint": {
        "file": "entry",
        "function": "compute"
    },
    "argument": {
        "samplings": [1e2, 1e4, 1e6, 1e7]
    } 
}

result = await worker_pool.schedule(
    task, 
    Listener(lambda d: print("Got intermediate result",d))
)

print(f"Got  final result", result)
'
"""

import numpy as np
import math
from python_playground.worker_thread import Emitter

def calc_pi(n):
    """
    @params n : number of draws
    @return approximation of Pi
    """
    r = 0
    for i in range(3):
        data = np.random.uniform(-0.5, 0.5, size=(n, 2))
        inside = len(
            np.argwhere(
                np.linalg.norm(data, axis=1) < 0.5
            )
        )
        r = r + (inside / n * 4)
    return r / 3

def compute(args):
    """
    Providing a list of samples count, the function compute an approximation of Pi for each element. 
    The function return the last approximation computed (using the last element of the provided list of samples count).
    The accumulated results at each step is emitted back to the main thread.
     
    @param args : a dictionary with attributes 'samplings', it defines the list of samples count.
    """
    counts = args["samplings"]
    r = None
    points = []
    for n in counts:
        print(f"Start to compute PI using {n} samples")
        r = calc_pi(n)
        points.append({"x":math.log10(n), "y":r})
        Emitter.send(points)
        
    return points
`

export function getDefaultWorker({ name }: { name: string }) {
    return {
        id: `${uuidv4()}`,
        name,
        capacity: 2,
        environment: {
            requirements: {
                pythonPackages: [],
                javascriptPackages: {
                    modules: [],
                    aliases: {},
                },
            },
            configurations: [
                {
                    name: 'default',
                    scriptPath: './entry.py',
                },
            ],
        },
        sources: [
            {
                path: './worker_entry.py',
                content: defaultWorkerSrc,
            },
        ],
    }
}
