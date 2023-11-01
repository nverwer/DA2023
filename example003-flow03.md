# Can we make Steven's diagram from 'A Declarative Code Browser with ixml and XForms'?

<img alt="from Steven Pemberton: 'A Declarative Code Browser with ixml and XForms'" src="ixml.png" width="500"/>

First attempt:

```mermaid
flowchart LR
description[/Description\] --> ixml-proc
text-document[Document] --> ixml-proc((ixml processor)) --> document[/Document\]
```

There is no way to indicate the direction of an arrow.


We can use subgraphs, but direction does not work when linking into the subgraph.

```mermaid
flowchart TB
description[/Description\] --> ixml-proc
subgraph ixml
  direction LR
  text-document[Document] --> ixml-proc((ixml processor)) --> document[/Document\]
end
```


We can link to the subgraph.
Maybe this is the best we can do, but it is not what we want.

```mermaid
flowchart LR
subgraph ixml
  direction TB
  description[/Description\] --> ixml-proc((ixml processor))
end
text-document[Document] --> ixml --> document[/Document\]
```
