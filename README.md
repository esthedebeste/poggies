<p align="center"><img src="https://cdn.betterttv.net/emote/5b457bbd0485f43277cecac0/3x"/></p>

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

### Dynamic Elements

You can add Elements to the children of an object dynamically!

#### `For` example:

```js
const { Poggies } = require("poggies");
const wow = new Poggies(`
div[Wow!]<for(word of words)[>word]>`);
wow
	.render({
		words: [" A ", "dynamic ", "page!"]
	})
	.then(html => {
		console.log(html);
	});
```

Will loop over the `words` parameter and add each word in it! Result:

```html
<div>Wow! A dynamic page!</div>
```

<div>Wow! A dynamic page!</div>

#### `If` example:

```js
const { Poggies } = require("poggies");
const wow = new Poggies(`
span<if(chance)[You're a lucky one.]>`);
wow
	.render({
		chance: Math.random() < 0.5
	})
	.then(html => {
		console.log(html);
	});
```

Will give you a 50% chance of seeing "You're a lucky one."! Result:

`<span></span>` OR `<span>You're a lucky one.</span>`

<blink><span>You're a lucky one.</span></blink>

<br/><br/><br/>

### Extras

<img src="https://cdn.betterttv.net/emote/5d38aaa592fc550c2d5996b8/1x" alt="peepoClap" align="left"/> You made it to the bottom of the README, it's time for some neat extras!

- Poggies syntax also supports # and . as shorthands for class and id! (They kind of look like CSS selectors)  
  Example:  
  `h1#woah.red.bold[I'm red, I'm bold, and my ID is woah!]`
- Attributes can have no value, just like in normal HTML! For example:  
  `h1(hidden)[You can't see me]`
- If an attribute doesn't contain any spaces, you can insert it without quotes,  
  `a(href=https://example.com/)[like this!]`  
  <small>PS, if it does contain a ), then this won't work</small>
- You can stack [], {}, and <>! For example, to put a line break in the middle of a span:  
  `span[Line 1]{br}[Line 2]` ==> `<span>Line 1<br/>Line 2</span>`
- Poggies also supports ESM, so you can also import things using `import { ____ } from "poggies"`!
- renderFile caches files, so your poor CPU doesn't have to parse everything again!  
  In a small test this lead to a pretty decent ~4ms to ~0.2ms improvement!
- Poggies has a bunch of JSDocs built in, meaning that your IDE will be able to show you a bit of a description about Poggies' functions and classes!
