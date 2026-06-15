async function test() {
  const url = "http://localhost:3000/api/crm/admin/sales?page=0&size=20&milestoneScope=crm&sort=updatedAt%2Cdesc&assigneeAliasSet=Razi&milestoneStage=Fresh+Lead";
  const res = await fetch(url, {
    headers: {
      "Authorization": process.env.CRM_DEV_BEARER_TOKEN ? `Bearer ${process.env.CRM_DEV_BEARER_TOKEN}` : ""
    }
  });
  const text = await res.text();
  console.log("Status:", res.status);
  try {
    const json = JSON.parse(text);
    console.log("Total Elements:", json.totalElements);
    console.log("Content Length:", json.content?.length);
    if (json.content?.length > 0) {
      console.log("First Lead Stage:", json.content[0].lead?.stage);
    }
  } catch (e) {
    console.log("Response text:", text.slice(0, 500));
  }
}
test();
