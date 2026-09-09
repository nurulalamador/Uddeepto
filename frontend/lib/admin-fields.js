export const adminFields={
  users:{name:'text',username:'text',role:['learner','hirer','admin'],account_status:['active','suspended','deactivated']},
  interest_categories:{name:'text',slug:'text',icon:'text',description:'textarea',is_active:'boolean'},
  courses:{title:'text',slug:'text',description:'textarea',category_id:'category',price:'number',currency:'text',status:['draft','published','archived']},
  contests:{name:'text',description:'textarea',category_id:'category',type:['general','competitive_programming','drawing','singing'],entry_fee:'number',currency:'text',status:['draft','published','cancelled','completed'],max_participants:'number',starting_time:'datetime-local',ending_time:'datetime-local'},
  webinars:{name:'text',description:'textarea',category_id:'category',meeting_url:'url',capacity:'number',status:['draft','scheduled','live','completed','cancelled'],starting_time:'datetime-local',ending_time:'datetime-local'},
  communities:{name:'text',slug:'text',description:'textarea',category_id:'category',requires_approval:'boolean',is_private:'boolean'},
  jobs:{title:'text',description:'textarea',type:['permanent','contract','internship','part_time','freelance','one_time'],status:['draft','open','closed','filled','cancelled'],location:'text',is_remote:'boolean'},
  showcase_posts:{content:'textarea',visibility:['public','private']},
  reported_showcase_posts:{status:['pending','reviewing','resolved','dismissed'],resolution_note:'textarea'}
};
