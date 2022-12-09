import shutil
from pathlib import Path

from youwol.pipelines.pipeline_typescript_weback_npm import Template, PackageType, Dependencies, \
    RunTimeDeps, generate_template, DevServer, Bundles, MainModule
from youwol_utils import parse_json

folder_path = Path(__file__).parent

pkg_json = parse_json(folder_path / 'package.json')

load_dependencies = {
    '@youwol/fv-code-mirror-editors': '^0.2.2',
    '@youwol/os-core': '^0.1.5',
    '@youwol/fv-tabs': '^0.2.1',
    '@youwol/os-top-banner': '^0.1.1',
    '@youwol/cdn-client': '^1.0.9',
    '@youwol/http-clients': '^2.0.1',
    '@youwol/flux-view': '^1.0.3',
    '@youwol/fv-context-menu': '^0.1.1',
    '@youwol/fv-tree': '^0.2.3',
    'lodash': '^4.17.15',
    'rxjs': '^6.5.5',
    "@youwol/logging": "^0.1.0",
    'uuid': '^8.3.2',
}

template = Template(
    path=folder_path,
    type=PackageType.Application,
    name=pkg_json['name'],
    version=pkg_json['version'],
    shortDescription=pkg_json['description'],
    author=pkg_json['author'],
    dependencies=Dependencies(
        runTime=RunTimeDeps(
            externals={
                **load_dependencies
            },
        ),
        devTime={
            #  those two prevent failure of typedoc
            "@types/lz-string": "^1.3.34",
            "lz-string": "^1.4.4"
        }
    ),
    userGuide=True,
    bundles=Bundles(
        mainModule=MainModule(
            entryFile="./index.ts",
            loadDependencies=list(load_dependencies.keys())
        )
    ),
    devServer=DevServer(
        port=3012
    )
)

generate_template(template)

shutil.copyfile(
    src=folder_path / '.template' / 'src' / 'auto-generated.ts',
    dst=folder_path / 'src' / 'auto-generated.ts'
)

for file in ['README.md', '.gitignore', '.npmignore', '.prettierignore', 'LICENSE', 'package.json',
             'tsconfig.json', 'webpack.config.ts']:
    shutil.copyfile(
        src=folder_path / '.template' / file,
        dst=folder_path / file
    )


