const { test, expect } = require('@playwright/test');
const XLSX = require('xlsx');


let jsonData=[]
let imageData=[]
let freeTrialData=[]

// Function to convert JSON to XLS and save it as a file
function jsonToXls(data, type) {
  // Create a new workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Append the worksheet to the workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  // Write the workbook to a file
  if(type ==="page")XLSX.writeFile(workbook, 'Test-result.xlsx');
  if(type ==="image")XLSX.writeFile(workbook, 'Image-result.xlsx');
  if(type ==="trial")XLSX.writeFile(workbook, 'trial-result.xlsx');
}

const imageCheck=async(page,imgSrc)=>{
  expect.soft(imgSrc?.length).toBeGreaterThan(1);
    if(imgSrc?.length>1){
      const res=await page.request.get(imgSrc);
      return res
    }}

const getPageLinks=async(page)=>{
  const links=await page?.$$eval('a', anchors =>{
    return anchors
      .filter(anchor => anchor.target === "" && anchor.href.startsWith("https"))
      .map(anchor => anchor.href);
  });
  return links;
}

const autoScroll = async (page) => {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
};

const getImageLinks = async (page) => {
  await autoScroll(page);
  const imageLinks = await page.$$eval('img', imgs => 
  {
    return imgs
    .filter(img => img.src.startsWith("http"))
    .map(img => img.src);
  }
  );
  return imageLinks;
};

const getallButtons = async (page) => {
  // Get all buttons on the page
  try{
    const button=await page.$$eval('a', btns =>{
      return btns
        .filter(anchor => anchor.textContent === "Get Support" && anchor.target === "" && anchor.href.startsWith("https"))
        .map(anchor => anchor.href);
    });
    return button;
  }catch(e){
    return []
  }
};


const getNextPageLinks=async(page)=>{
  try{
    const links=await page.$$eval('a', anchors =>{
      return anchors
        .filter(anchor => anchor.className === "next page-numbers" && anchor.target === "" && anchor.href.startsWith("https"))
        .map(anchor => anchor.href);
    });
    return links;
  }catch(e){
    return []
  }
}

const checkBlogPageLink=async(page, blogLink)=>{
  await autoScroll(page);
  const links = await page?.$$eval('div.entry-content a', anchors => {
    return anchors
      .filter(anchor => anchor.target === "" && anchor.href.startsWith("https"))
      .map(anchor => anchor.href);
  });
  const containsFreeTrail = await page?.$$eval('div.entry-content p', (paras) => {
    return paras.some(para => para.textContent.includes("free trail") || para.textContent.includes("free trial"));
  });
  if(containsFreeTrail){
    freeTrialData.push({
      link: blogLink
    })
  }
  for (const link of [... new Set(links)]) {
    if(link && link.length>0){
      const status = await checkLinkStatus(link,page);
      jsonData.push({
        "blogLink": blogLink,
        "internalBlogLink": link,
        "status": status,
        "updatedAt": new Date().toLocaleString() // Add the current date and time
    });
      console.log(`Blog Links: ${link}, Status: ${status}`)

    }
  }
}

const filterBlogLink=async(page, links, imageLinks,pageLink)=>{
  let imageErrorCount=0;
  const nextLink=await getNextPageLinks(page);
  for (const link of [... new Set(links)]) {
    if (link && link.includes("/blog/") && !link.includes("/category")) {
      const status = await checkLinkStatus(link,page);
      console.log(`Link: ${link}, Status: ${status}`);
      await checkBlogPageLink(page,link);
      jsonData.push({
        "blogLink":link,
        "internalBlogLink": "",
        "status":status,
        "updatedAt": new Date().toLocaleString() // Add the current date and time
      })
    }
  }
  for (const image of (imageLinks)) {
    if(image && image.split('.').length<3){
      console.log("Image check", image)
      imageErrorCount++
      continue;
    }
    if (image && !image.includes("linkedin")) {
      const status = await checkLinkStatus(image,page);
      imageData.push({
        "imageLink": image,
        "pageLink": pageLink,
        "status": status,
        "updatedAt": new Date().toLocaleString() // Add the current date and time
      });
      console.log(`Image Link: ${image}, Status: ${status}`);
    }
  }

  if(imageErrorCount>0){
    imageData.push({
      "imageLink": `${imageErrorCount} image links broken`,
      "pageLink": pageLink,
      "status": 404,
      "updatedAt": new Date().toLocaleString() // Add the current date and time
    })
  }

  console.log(`Error: ${imageErrorCount} images found broken in page: ${pageLink} `)

  // console.log("-----------------------",nextLink)
  if(nextLink && nextLink.length>0){
      console.log("inside nex link block",nextLink[0])
      const response=await page.goto(nextLink[0], { waitUntil: 'domcontentloaded' });
      if(response){
        await page.waitForLoadState('domcontentloaded'); 
        const nextPageLinks=await getPageLinks(page);
        const imageLinks= await getImageLinks(page)
        await filterBlogLink(page, nextPageLinks,imageLinks, nextLink[0])
      }
    }
  
}

// Function to check the status of each link
const checkLinkStatus = async (url,page) => {
  try {
    if(url.includes("#")){
      url= url.split("#").shift()
    }
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    return response.status();
  } catch (error) {
    // console.error(`Error checking ${url}:`, error);
    return null;
  }
};

test.beforeEach(async({page})=>{
  await page.goto("https://ludhiana.com/devicemax");
})

test.describe('Devicemax',()=>{

  test('Test to login',async({page})=>{
    jsonData=[]
    imageData=[]
    await expect(page).toHaveTitle(/DeviceMax/)
  })
  
  test("test for the home page",async({page})=>{
    
    await autoScroll(page) 
    const links = await getPageLinks(page);
  
    
    for (const link of [... new Set(links)]) {
      if(link && link.length>0){ 
        let imageErrorCount=0
        const status = await checkLinkStatus(link,page);
        const buttonLinks= await getallButtons(page);
        if(buttonLinks.length>0){
          const status = await checkLinkStatus(buttonLinks[0],page);
          console.log(`Blog Links--: ${buttonLinks[0]}, Status: ${status}`)
        }
        jsonData.push({
          "blogLink": link,
          "internalBlogLink": buttonLinks.length>0?buttonLinks[0]:'',
          "status": status,
          "updatedAt": new Date().toLocaleString() // Add the current date and time
        });
        console.log(`Blog Links: ${link}, Status: ${status}`)
        
        const imageLinks= await getImageLinks(page)
  
        for (const image of (imageLinks)) {
          if(image && image.split('.').length<3){
            console.log("Image check", image)
            imageErrorCount++
            continue;
          }
          if (image && !image.includes("linkedin")) {
            const status = await checkLinkStatus(image,page);
            imageData.push({
              "imageLink": image,
              "pageLink": link,
              "status": status,
              "updatedAt": new Date().toLocaleString() // Add the current date and time
            });
            console.log(`Image Link: ${image}, Status: ${status}`);
          }
        }

        if(imageErrorCount>0){
          imageData.push({
            "imageLink": `${imageErrorCount} image links broken`,
            "pageLink": link,
            "status": 404,
            "updatedAt": new Date().toLocaleString() // Add the current date and time
          })
        }
  
      }
    }
    
    console.log("Saving Homepage data")
  })
  
  
  
  test("test for the Blog category wise",async({page})=>{
    // Navigate to the 'Knowledge Hub'
    await page.locator('#menu-item-4376').getByRole('link', { name: 'Knowledge Hub' }).click();
  
    const blogHeading= await page.getByRole('heading', { name: 'Devicemax Blog' }).textContent(); 
  
    expect(blogHeading).toBe('Devicemax Blog')
  
    await autoScroll(page)
  
    const pagelinks = await getPageLinks(page);
  
    for (const link of [... new Set(pagelinks)]) {
      if (link && link.includes("/category")) {
        await page.goto(link, { waitUntil: 'domcontentloaded' })
        // Retrieve all links on the updated page instance                                                                                 
        const links = await getPageLinks(page);
        const imageLinks= await getImageLinks(page)
        // Filter and check the status of each blog link
        await filterBlogLink(page, links, imageLinks,link);
        // if(jsonData) jsonToXls(jsonData)
      }
    }
  
  })

  //Search functionality
 test("test for the search functionality",async({page})=>{
  await page.locator('#menu-item-4376').getByRole('link', { name: 'Knowledge Hub' }).click();
  await page.getByPlaceholder('Search').click();
  await page.getByPlaceholder('Search').press('CapsLock');
  await page.getByPlaceholder('Search').fill('MDM');
  await page.getByPlaceholder('Search').press('Enter');
  const result= await page.getByRole('link', { name : 'MDM Solution for Last Mile Delivery'})
  expect(result).toBeTruthy;
})
  //Contact Us Form
  // test.only('contact us form', async({page})=>{
  //   await page.goto('https://devicemax.com/contact-us/');
  //   await page.locator('#cust-name1').click();
  //   await page.locator('#cust-name1').fill('Sample');
  //   await page.locator('#cust-name1').press('Tab');
  //   await page.locator('#cust-email1').fill('sample@test.com');
  //   await page.locator('#cust-email1').press('Tab');
  //   await page.locator('#cust-mobile1').fill('9999999999');
  //   await page.locator('#cust-mobile1').press('Tab');
  //   await page.locator('input[name="lead-company"]').fill('Kochar');
  //   await page.locator('input[name="lead-company"]').press('Tab');
  //   await page.locator('textarea[name="lead-message"]').fill('Sample DEscription');
  //   await page.getByRole('button', { name: 'Submit' }).click();
  //   // await page.goto('https://ludhiana.com/devicemax/thank-you/');
  //   const success=await page.getByText('Thank you for getting in').textContent();
  //   expect(success).toBeTruthy()
  // })

  test.afterAll(() => {
    console.log("Generating Excel Reports");
    console.log("---------------------------------------Length",jsonData.length,  imageData.length )
    if (jsonData.length > 0) jsonToXls(jsonData, "page");
    if (freeTrialData.length > 0) jsonToXls(freeTrialData, "trial");
    if (imageData.length > 0) jsonToXls(imageData, "image");
  });

})