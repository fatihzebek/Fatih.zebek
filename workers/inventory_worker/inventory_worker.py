import firebase_admin
from firebase_admin import credentials, firestore
import time
import os
from datetime import datetime

# Initialize Firebase
# NOTE: Ensure serviceAccountKey.json is placed in this directory
try:
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_admin.initialize_app(cred)
except Exception as e:
    print(f"Error initializing Firebase: {e}")
    # Fallback to default credentials if available
    firebase_admin.initialize_app()

db = firestore.client()

def update_stock_transaction(transaction, inventory_ref, quantity):
    snapshot = inventory_ref.get(transaction=transaction)
    if not snapshot.exists:
        print("Inventory item does not exist.")
        return False
    
    current_stock = snapshot.get('current_stock') or 0
    new_stock = current_stock - quantity
    
    if new_stock < 0:
        print(f"Warning: Stock would go below zero ({new_stock}). Deduction forced but logged.")
    
    transaction.update(inventory_ref, {
        'current_stock': new_stock,
        'last_updated': firestore.SERVER_TIMESTAMP
    })
    return True

def process_task(task_doc):
    task_id = task_doc.id
    task_data = task_doc.to_dict()
    
    # Process only COMPLETED tasks that haven't been deducted yet
    if task_data.get('status') == 'COMPLETED' and not task_data.get('stockDeducted'):
        print(f"\n[{datetime.now()}] Processing COMPLETED Task: {task_id}")
        
        materials = task_data.get('usedMaterials', [])
        warehouse_id = task_data.get('warehouseId') # Ensure this is saved in frontend
        
        if not warehouse_id:
            # Fallback mapping if warehouseId is missing in task
            site_name = task_data.get('siteName', '').lower()
            if 'anemon' in site_name: warehouse_id = 'anemon-depo'
            elif 'bakras' in site_name: warehouse_id = 'bakras-depo'
            # Add more fallback mappings as needed
        
        if not warehouse_id or not materials:
            print(f"Skipping: No materials or warehouse identified for task {task_id}")
            return

        success_count = 0
        for mat in materials:
            mat_id = mat.get('sapNo')
            qty = float(mat.get('quantity', 0))
            
            if not mat_id or qty <= 0: continue
            
            inventory_ref = db.collection('warehouses').document(warehouse_id).collection('inventory').document(mat_id)
            
            transaction = db.transaction()
            try:
                if update_stock_transaction(transaction, inventory_ref, qty):
                    success_count += 1
            except Exception as e:
                print(f"Transaction failed for {mat_id}: {e}")

        # Mark task as deducted to prevent re-processing
        if success_count > 0:
            db.collection('tasks').document(task_id).update({
                'stockDeducted': True,
                'stockDeductedAt': firestore.SERVER_TIMESTAMP
            })
            print(f"Successfully deducted {success_count} materials for task {task_id}")

def main():
    print("--- DH SERVIS Inventory Worker Started ---")
    print("Listening for task completion events...")
    
    # Create a query to watch for completed tasks
    # In a real environment, we would use snapshots for real-time
    # For this script, we'll poll to be more robust for local dev
    while True:
        try:
            tasks_ref = db.collection('tasks').where('status', '==', 'COMPLETED').where('stockDeducted', '!=', True)
            docs = tasks_ref.stream()
            
            for doc in docs:
                process_task(doc)
                
            time.sleep(10) # Poll every 10 seconds
        except Exception as e:
            print(f"Worker Loop Error: {e}")
            time.sleep(30)

if __name__ == "__main__":
    main()
