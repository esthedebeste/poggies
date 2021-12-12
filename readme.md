<p align="center"><img src="https://cdn.betterttv.net/emote/5b457bbd0485f43277cecac0/3x"/></p>

# poggies

Poggies is a simple 0-dependencies HTML templating engine, with a very simple syntax.

## Usage

Using Poggies comes in two steps: Initializating a document and Rendering it.

You can initialize a document using `new Poggies(<code>)`. After this, you can render the document using `Poggies.render()`

```js
import { Poggies } from "poggies";
const hello = new Poggies('h1(class="red bold")[Hello World!]');
const html = await hello.render();
console.log(html);
```

This will log:

```html
<h1 class="red bold">Hello World!</h1>
```

You can also use renderFile, which renders the contents of a file (hello.pog containing your poggies code, of course):

```js
import { renderFile } from "poggies";
const html = await renderFile("hello.pog");
console.log(html);
```

## Syntax

Basic example document:

```
!doctype(html)
html(lang=en-US){
    head{
        title[Example Page]
        style[
            #header{
              text-align: center;
            }
            .red{
                color: red;
            }
        ]
    }
    body{
        h1#header.red(onclick="alert('Hi')")[Hello World!]
        br
        span[:)]
    }
}
```

Poggies also supports JavaScript in the templates (and async/await syntax!)

To add dynamic elements to your page, add a > like so:

```
h1(class="red bold")[>`six plus six is ${6+6}`]
```

Which, when rendered, will evaluate to

```html
<h1 class="red bold">six plus six is 12</h1>
```

You can also input variables into the rendering process! This is done by adding an extra argument into `Poggies.render()`!

```js
const hello = new Poggies(
	'h1(class="red bold")[>`${first} plus ${second} is ${first+second}`]'
);
const html = await hello.render({
	first: 12,
	second: 26,
});
console.log(html);
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
import { Poggies } from "poggies";
const wow = new Poggies("div[For ]<for(word of words)[>word]>");
const html = await wow.render({
	words: ["loops ", "are ", "cool"],
});
console.log(html);
```

Will loop over the `words` array and display each word! Result:

```html
<div>For loops are cool</div>
```

<div>For loops are cool</div>

#### `If` example:

```js
import { Poggies } from "poggies";
const wow = new Poggies(`
span<if(chance)[You got it!]>`);
const html = await wow.render({
	chance: Math.random() < 0.5,
});
console.log(html);
```

Will give you a 50% chance of seeing "You got it!" Result:

`<span></span>` OR `<span>You got it!</span>`

<span>You got it!</span>

### Templates

Poggies supports templates, which allow for easier repetition of elements.
To create a template, you can add a $ sign to the beginning of your element at the top level.
For Example:

```
$row(name addr){
  tr{
    td.name[>name]
    td.addr[>addr]
  }
}
table{
  $row(name="1st" addr="2nd")
}
```

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
  <small>PS, if it does contain a ), this won't work</small>
- You can stack [], {}, and <>! For example, to put a line break in the middle of a span:  
  `span[Line 1]{br}[Line 2]` ==> `<span>Line 1<br/>Line 2</span>`
- renderFile caches files, so your poor CPU doesn't have to parse everything again!  
  In a small test this lead to a huge ~3.6ms to ~0.015ms improvement!
