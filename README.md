# poggies

Poggies is a simple HTML templating engine, following a very simple syntax.

## Usage

Using Poggies comes in two steps: Initializating a document and Rendering it.

You can initialize a document using `new Poggies(<code>)`

```js
const { Poggies } = require("poggies");
const hello = new Poggies('h1(class="red bold")[Hello World!]');
```

After this initialization step, you can render the document using `Poggies.render()`

```js
hello.render().then(html => {
	console.log(html);
});
```

This will log:

```html
<h1 class="red bold">Hello World!</h1>
```

## Syntax

Simple example document:

```
html(lang="en-US"){
    head{
        title[Example Page]
        style[
            .red{
                color: red;
            }
            .bold{
                font-weight: bold;
            }
        ]
    }
    body{
        h1(class="red bold")[Hello World!]
    }
}
```

Poggies also supports JavaScript in the templates. To use that, add an > like so:

```
h1(class="red bold")[>`six plus six is ${6+6}`]
```

Which, when rendered, will evaluate to

```html
<h1 class="red bold">six plus six is 12</h1>
```

You can also input variables into the rendering process! This is done by adding an extra argument into `Poggies.render()`!

```js
const { Poggies } = require("poggies");
const hello = new Poggies(
	'h1(class="red bold")[>`${first} plus ${second} is ${first+second}`]'
);
hello
	.render({
		first: 12,
		second: 26
	})
	.then(html => {
		console.log(html);
	});
```

This will evaluate to

```html
<h1 class="red bold">12 plus 26 is 38</h1>
```
