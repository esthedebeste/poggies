# poggies

Poggies is a simple 0-dependencies HTML templating engine, with a very simple syntax.

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

You can also just directly use renderFile like this (hello.pog containing your poggies code, of course):

```js
const { renderFile } = require("poggies");
renderFile("hello.pog").then(html => {
	console.log(html);
});
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

Poggies also supports JavaScript in the templates (and async/await syntax!)

To add dynamic elements to your page, add an > like so:

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

Custom variables also work with renderFile of course, just input your variables into renderFile's second argument :D
<br/><br/><br/>
### Extras

<img src="https://cdn.betterttv.net/emote/5d38aaa592fc550c2d5996b8/1x" alt="peepoClap" align="left"/> You made it to the bottom of the README, it's time for some neat extras!

- Poggies syntax also supports # and . as shorthands for class and id! (They kind of look like CSS selectors)  
  Example:  
  `h1#woah.red.bold[I'm red, I'm bold, and my ID is woah!]`
- Attributes can have no value, just like in normal HTML! For example:  
  `h1(hidden)[You can't see me]`
- Poggies also supports ESM, so you can also import things using `import { ____ } from "poggies"`!
- renderFile actually caches files, so your poor CPU doesn't have to parse everything again!  
  In a small test this lead to a pretty decent ~4ms to ~0.2ms improvement!
- Poggies has a bunch of JSDocs built in, meaning that your IDE will be able to show you a bit of a description about Poggies' functions and classes!
