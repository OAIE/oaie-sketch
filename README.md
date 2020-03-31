# oaie-sketch
OpenAPI Visual Editor

OAIE Sketch offers a side-by-side code editor and visual editor.

Starting documents like this will add a viz (visualisation) into the header (this will show up as a graphic in swagger). Sketch can persist and load entity positions to and from this viz.

    openapi: "3.0.0"
    info:
      version: "0.0.1"
      title: My Service
      description: |
        My introductory information
        <!--OAIE.viz--><!--/OAIE.viz-->

![oaie-sketch.png](oaie-sketch.png)

## Caveats
- Currently only tested on Chrome.
- local storage is used as persistence. this means that currently it is only feasible to edit one spec at a time (much like the Swagger online editor).

## TODO
- find contributors
- restructure project
- refactor into smaller units
- integrate CodeMirror as editor with yaml tooling
- allow multi-project workflows within the same browser
- show circular references
- git integration
- server for local self-hosting
- global site with hosting
- ...
