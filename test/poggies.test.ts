import { checker } from "./utils.ts"

Deno.test("readme documents", async (t) => {
	const check = checker(t)
	await check(
		"top",
		`
!doctype(html)
html(lang=en-US) {
    head {
        title "Example Page"
        style "
            #header{
                text-align: center;
            }
            .red{
                color: red;
            }
        "
    }
    body {
        h1#header.red(onclick="alert('Hi')") "Hello World!"
        br
        span ":)"
    }
}`,
		`
<!doctype html>
<html lang="en-US">
    <head>
        <title>Example Page</title>
        <style>
            #header{
                text-align: center;
            }
            .red{
                color: red;
            }
        </style>
    </head>
    <body>
        <h1 id="header" class="red" onclick="alert('Hi')">Hello World!</h1>
        <br>
        <span>:)</span>
    </body>
</html>`,
	)

	await check(
		"usage",
		`h1(class="red bold") "Hello World!"`,
		`<h1 class="red bold">Hello World!</h1>`,
	)

	await check(
		"Syntax basic template",
		'h1(class="red bold") `six plus six is ${6+6}`',
		'<h1 class="red bold">six plus six is 12</h1>',
	)

	await check(
		"Syntax input variables",
		'h1(class="red bold") `${first} plus ${second} is ${first+second}`',
		'<h1 class="red bold">12 plus 26 is 38</h1>',
	)

	await check(
		"Dynamic For",
		`div "For " {
        for(word of words) \`\${word} \`
      }`,
		"<div>For loops are cool </div>",
	)

	await check(
		"Dynamic If - False Case",
		`span {
        if(chanceFalse) "You got it!"
        else ":("
      }`,
		"<span>:(</span>",
	)

	await check(
		"Dynamic If - True Case",
		`span {
        if(chanceTrue) "You got it!"
        else ":("
      }`,
		"<span>You got it!</span>",
	)

	await check(
		"Templates",
		`$$row(name thebest){
        tr{
          td.name \`\${name}\`
          td(class=(thebest ? "thebest" : "notthebest")) {
            if(thebest) "The Best :D"
            else "Not the Best :("
          }
        }
      }
      table {
        for(user of users){
          // use the template with $row
          $row(name=(user.name) thebest=(user.thebest))
        }
      }`,
		`<table>
      <tr>
          <td class="name">Esthe de Beste</td>
          <td class="thebest">The Best :D</td>
      </tr>
      <tr>
          <td class="name">John Doe</td>
          <td class="notthebest">Not the Best :(</td>
      </tr>
  </table>`,
	)

	await check(
		"Slots - Default",
		`$$centered_div {
            div(style="display: grid; place-items: center;") {
              div {
                // embed a slot with \`slot!\`
                slot!
              }
            }
          }
          
          $centered_div {
            h1 "Hi!"
          }`,
		`<div style="display: grid; place-items: center;">
        <div>
          <h1>Hi!</h1>
        </div>
      </div>`,
	)

	await check(
		"Slots - Named",
		`$$red_and_blue(red blue) {
        div(style="color: red;") {
          // \`slot!(name)\` for named slots.
          slot!(red)
        }
        div(style="color: blue;") {
          slot!(blue)
        }
      }
      
      $red_and_blue(red={
        h1 "Red!"
      } blue={
        h1 "Blue!"
      })`,
		`<div style="color: red;">
      <h1>Red!</h1>
    </div>
    <div style="color: blue;">
      <h1>Blue!</h1>
    </div>`,
	)

	await check(
		"Extras - idclass",
		`h1#woah.red.bold "I'm red, I'm bold, and my ID is woah!"`,
		`<h1 id="woah" class="red bold">I'm red, I'm bold, and my ID is woah!</h1>`,
	)
	await check("Extras - hidden", `h1(hidden) "You can't see me"`, `<h1 hidden>You can't see me</h1>`)
	await check(
		"Extras - quoteless",
		`a(href=https://example.com/) "like this!"`,
		`<a href="https://example.com/">like this!</a>`,
	)

	await check(
		"Extras - attribute shorthand",
		`a((href))`,
		`<a href="https://example.com/"></a>`,
	)

	await check(
		"Extras - stacking quotes and {}",
		`span "Line 1" { br } "Line 2"`,
		`<span>Line 1<br>Line 2</span>`,
	)

	await check(
		"huge test page (bench.pog)",
		await Deno.readTextFile(new URL("bench.pog", import.meta.url)),
		`<!doctype html>
    <html lang="en-US">
      <head>
        <title>Test Page</title>
        <style>
          #root {
            font-family: cursive;
          }
          .green {
            color: lime;
          }
          .red {
            color: red;
          }
          .bold {
            font-weight: bold;
          }
          table {
            border-collapse: collapse;
          }
          table,
          th,
          td {
            border: 3px solid pink;
          }
        </style>
      </head>
      <body id="root">
        <h1 id="hey-world" class="red bold">Hello World!</h1>
        <p class="bold green" data-close=")">:D</p>
        <a href="https://example.com/" target="_blank">example.com</a>
        <ul>
          <li>1</li>
          <li>2</li>
          <li>3</li>
        </ul>
        <p class="red" hidden>
          If this is visible, attributes aren't working properly.
        </p>
        <h1>People:</h1>
        <table>
          <tr>
            <th class="name">Name</th>
            <th class="thebest">The Best?</th>
            <th>Slotted</th>
            <th>Default Slotted</th>
          </tr>
          <tr>
            <td class="name">Esthe de Beste</td>
            <td class="thebest">The Best :D</td>
            <td>^_^</td>
            <td>Yep!</td>
          </tr>
          <tr>
            <td class="name">John Doe</td>
            <td class="notthebest">Not the Best :(</td>
            <td>^_^</td>
            <td>Yep!</td>
          </tr>
        </table>
        <br>
        If statements work! 
        <br>
        For of loops work! 
        <br>
        For and If combined is working!
      </body>
    </html>
    <multielemtest>
      <div>
        Multiple Parent Elements work!
      </div>
    </multielemtest>`,
	)

})

Deno.test("checks", async (t) => {
  const check = checker(t)
  
  await check(
    "empty template",
    `
    $$thing() 
    $thing
    `,
    "" 
  )
})