const Test = () => {
  return <p>test</p>;
};

export default Test;

/*

to create a playlist 
    Request URL = https://api.bambicloud.com/playlists
    Request Method = POST
    Request body = {
        "name": "qq",
        "description": "",
        "expLevel": 1,
        "isCore": false
    }
    Request Response = {
        "id": 83984,
        "name": "qq",
        "isPublic": false,
        "isCore": false,
        "creator": {
            "id": 34422,
            "username": "sissyboy914"
        },
        "expLevel": "Beginner",
        "description": "",
        "dateCreated": "2026-02-05",
        "uuid": "2d174ba3-05be-4ed0-9e00-43d0c715c075",
        "imageURL": null,
        "files": [],
        "order": null,
        "isPlan": false,
        "likes": 0,
        "dislikes": 0
    }

to add files to a playlist
    Request URL = https://api.bambicloud.com/playlists
    Request Method = PUT
    Requst body = {
        "id": 83984, //playlist ID returned from creation request
        "fileIds": [
            10
        ]
    }
*/
